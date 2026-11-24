// Package service implements the TripExpensesService API on top of the database.
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"connectrpc.com/connect"
	"gorm.io/gorm"

	tev1 "github.com/nikola93/tripexpenses/backend/gen/tripexpenses/v1"
	"github.com/nikola93/tripexpenses/backend/gen/tripexpenses/v1/tripexpensesv1connect"
	"github.com/nikola93/tripexpenses/backend/internal/balance"
	"github.com/nikola93/tripexpenses/backend/internal/db"
)

// Service serves the TripExpensesService API.
type Service struct {
	db *gorm.DB
}

var _ tripexpensesv1connect.TripExpensesServiceHandler = (*Service)(nil)

// New returns a Service backed by the given database.
func New(gdb *gorm.DB) *Service {
	return &Service{db: gdb}
}

func (s *Service) ListSheets(ctx context.Context, _ *connect.Request[tev1.ListSheetsRequest]) (*connect.Response[tev1.ListSheetsResponse], error) {
	var sheets []db.Sheet
	if err := s.db.WithContext(ctx).Order("id DESC").Find(&sheets).Error; err != nil {
		return nil, internal(err)
	}
	resp := &tev1.ListSheetsResponse{}
	for _, sh := range sheets {
		resp.Sheets = append(resp.Sheets, toSheetPB(sh))
	}
	return connect.NewResponse(resp), nil
}

func (s *Service) CreateSheet(ctx context.Context, req *connect.Request[tev1.CreateSheetRequest]) (*connect.Response[tev1.CreateSheetResponse], error) {
	sh := db.Sheet{Name: strings.TrimSpace(req.Msg.GetName())}
	if err := s.db.WithContext(ctx).Create(&sh).Error; err != nil {
		return nil, internal(err)
	}
	return connect.NewResponse(&tev1.CreateSheetResponse{Sheet: toSheetPB(sh)}), nil
}

func (s *Service) SaveSheet(ctx context.Context, req *connect.Request[tev1.SaveSheetRequest]) (*connect.Response[tev1.SaveSheetResponse], error) {
	sh, err := s.findSheet(ctx, req.Msg.GetId())
	if err != nil {
		return nil, err
	}
	sh.Name = strings.TrimSpace(req.Msg.GetName())
	sh.Saved = true
	if err := s.db.WithContext(ctx).Select("Name", "Saved").Updates(&sh).Error; err != nil {
		return nil, internal(err)
	}
	return connect.NewResponse(&tev1.SaveSheetResponse{Sheet: toSheetPB(sh)}), nil
}

func (s *Service) ListTravelers(ctx context.Context, req *connect.Request[tev1.ListTravelersRequest]) (*connect.Response[tev1.ListTravelersResponse], error) {
	var travelers []db.Traveler
	if err := s.db.WithContext(ctx).Where("sheet_id = ?", req.Msg.GetSheetId()).Order("id").Find(&travelers).Error; err != nil {
		return nil, internal(err)
	}
	resp := &tev1.ListTravelersResponse{}
	for _, t := range travelers {
		resp.Travelers = append(resp.Travelers, toTravelerPB(t))
	}
	return connect.NewResponse(resp), nil
}

func (s *Service) CreateTraveler(ctx context.Context, req *connect.Request[tev1.CreateTravelerRequest]) (*connect.Response[tev1.CreateTravelerResponse], error) {
	name := strings.TrimSpace(req.Msg.GetName())
	if name == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("name is required"))
	}
	if _, err := s.findSheet(ctx, req.Msg.GetSheetId()); err != nil {
		return nil, err
	}
	t := db.Traveler{SheetID: req.Msg.GetSheetId(), Name: name}
	if err := s.db.WithContext(ctx).Create(&t).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, connect.NewError(connect.CodeAlreadyExists, fmt.Errorf("traveler %q already exists", name))
		}
		return nil, internal(err)
	}
	return connect.NewResponse(&tev1.CreateTravelerResponse{Traveler: toTravelerPB(t)}), nil
}

func (s *Service) ListExpenses(ctx context.Context, req *connect.Request[tev1.ListExpensesRequest]) (*connect.Response[tev1.ListExpensesResponse], error) {
	expenses, err := s.loadExpenses(ctx, req.Msg.GetSheetId())
	if err != nil {
		return nil, internal(err)
	}
	resp := &tev1.ListExpensesResponse{}
	for _, e := range expenses {
		resp.Expenses = append(resp.Expenses, toExpensePB(e))
	}
	return connect.NewResponse(resp), nil
}

func (s *Service) CreateExpense(ctx context.Context, req *connect.Request[tev1.CreateExpenseRequest]) (*connect.Response[tev1.CreateExpenseResponse], error) {
	msg := req.Msg
	ids := map[uint64]bool{msg.GetPayerId(): true}
	seen := map[uint64]bool{}
	e := db.Expense{
		SheetID:     msg.GetSheetId(),
		Description: strings.TrimSpace(msg.GetDescription()),
		PayerID:     msg.GetPayerId(),
	}
	for _, sh := range msg.GetShares() {
		if sh.GetAmount() < 0 {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("share amounts must not be negative"))
		}
		if seen[sh.GetTravelerId()] {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("traveler %d has more than one share", sh.GetTravelerId()))
		}
		seen[sh.GetTravelerId()] = true
		ids[sh.GetTravelerId()] = true
		e.Shares = append(e.Shares, db.ExpenseShare{TravelerID: sh.GetTravelerId(), Amount: sh.GetAmount()})
	}

	var known int64
	if err := s.db.WithContext(ctx).Model(&db.Traveler{}).Where("sheet_id = ? AND id IN ?", msg.GetSheetId(), keys(ids)).Count(&known).Error; err != nil {
		return nil, internal(err)
	}
	if known != int64(len(ids)) {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("payer and shares must refer to travelers of the sheet"))
	}

	if err := s.db.WithContext(ctx).Create(&e).Error; err != nil {
		return nil, internal(err)
	}
	return connect.NewResponse(&tev1.CreateExpenseResponse{Expense: toExpensePB(e)}), nil
}

func (s *Service) DeleteExpense(ctx context.Context, req *connect.Request[tev1.DeleteExpenseRequest]) (*connect.Response[tev1.DeleteExpenseResponse], error) {
	res := s.db.WithContext(ctx).Delete(&db.Expense{}, req.Msg.GetId())
	if res.Error != nil {
		return nil, internal(res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("expense %d not found", req.Msg.GetId()))
	}
	return connect.NewResponse(&tev1.DeleteExpenseResponse{}), nil
}

func (s *Service) GetBalances(ctx context.Context, req *connect.Request[tev1.GetBalancesRequest]) (*connect.Response[tev1.GetBalancesResponse], error) {
	expenses, err := s.loadExpenses(ctx, req.Msg.GetSheetId())
	if err != nil {
		return nil, internal(err)
	}
	in := make([]balance.Expense, 0, len(expenses))
	for _, e := range expenses {
		be := balance.Expense{PayerID: e.PayerID}
		for _, sh := range e.Shares {
			be.Shares = append(be.Shares, balance.Share{TravelerID: sh.TravelerID, Amount: sh.Amount})
		}
		in = append(in, be)
	}
	gross := balance.Gross(in)
	return connect.NewResponse(&tev1.GetBalancesResponse{
		Gross: toDebtsPB(gross),
		Net:   toDebtsPB(balance.Net(gross)),
	}), nil
}

// findSheet loads a sheet, or returns a NotFound error if there is none.
func (s *Service) findSheet(ctx context.Context, id uint64) (db.Sheet, error) {
	var sh db.Sheet
	if err := s.db.WithContext(ctx).First(&sh, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return sh, connect.NewError(connect.CodeNotFound, fmt.Errorf("sheet %d not found", id))
		}
		return sh, internal(err)
	}
	return sh, nil
}

func (s *Service) loadExpenses(ctx context.Context, sheetID uint64) ([]db.Expense, error) {
	var expenses []db.Expense
	err := s.db.WithContext(ctx).
		Where("sheet_id = ?", sheetID).
		Preload("Shares", func(tx *gorm.DB) *gorm.DB { return tx.Order("traveler_id") }).
		Order("id").
		Find(&expenses).Error
	return expenses, err
}

func toSheetPB(sh db.Sheet) *tev1.Sheet {
	return &tev1.Sheet{Id: sh.ID, Name: sh.Name, Saved: sh.Saved}
}

func toTravelerPB(t db.Traveler) *tev1.Traveler {
	return &tev1.Traveler{Id: t.ID, Name: t.Name}
}

func toExpensePB(e db.Expense) *tev1.Expense {
	pb := &tev1.Expense{Id: e.ID, Description: e.Description, PayerId: e.PayerID}
	for _, sh := range e.Shares {
		pb.Shares = append(pb.Shares, &tev1.Share{TravelerId: sh.TravelerID, Amount: sh.Amount})
	}
	return pb
}

func toDebtsPB(debts []balance.Debt) []*tev1.Debt {
	out := make([]*tev1.Debt, 0, len(debts))
	for _, d := range debts {
		out = append(out, &tev1.Debt{FromTravelerId: d.From, ToTravelerId: d.To, Amount: d.Amount})
	}
	return out
}

func keys(m map[uint64]bool) []uint64 {
	out := make([]uint64, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func internal(err error) error {
	return connect.NewError(connect.CodeInternal, err)
}
