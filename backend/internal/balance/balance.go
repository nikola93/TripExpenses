// Package balance works out who owes whom from a list of expenses.
package balance

import "sort"

// Share is the part of an expense that falls on one traveler.
type Share struct {
	TravelerID uint64
	Amount     int64
}

// Expense is a cost paid by PayerID and split into Shares.
type Expense struct {
	PayerID uint64
	Shares  []Share
}

// Debt says that From owes To the given Amount.
type Debt struct {
	From   uint64
	To     uint64
	Amount int64
}

type pair struct{ from, to uint64 }

// Gross sums, for every expense, each traveler's share into a debt towards
// the payer. The payer's own share is not a debt. Zero debts are left out.
func Gross(expenses []Expense) []Debt {
	totals := map[pair]int64{}
	for _, e := range expenses {
		for _, s := range e.Shares {
			if s.TravelerID == e.PayerID || s.Amount == 0 {
				continue
			}
			totals[pair{s.TravelerID, e.PayerID}] += s.Amount
		}
	}
	return toDebts(totals)
}

// Net offsets the debts between each pair of travelers, so that at most one
// of them owes the other.
func Net(gross []Debt) []Debt {
	totals := map[pair]int64{}
	for _, d := range gross {
		totals[pair{d.From, d.To}] += d.Amount
	}
	net := map[pair]int64{}
	for p, amount := range totals {
		if diff := amount - totals[pair{p.to, p.from}]; diff > 0 {
			net[p] = diff
		}
	}
	return toDebts(net)
}

func toDebts(totals map[pair]int64) []Debt {
	debts := make([]Debt, 0, len(totals))
	for p, amount := range totals {
		if amount != 0 {
			debts = append(debts, Debt{From: p.from, To: p.to, Amount: amount})
		}
	}
	sort.Slice(debts, func(i, j int) bool {
		if debts[i].From != debts[j].From {
			return debts[i].From < debts[j].From
		}
		return debts[i].To < debts[j].To
	})
	return debts
}
