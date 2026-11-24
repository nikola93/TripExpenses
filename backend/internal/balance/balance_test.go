package balance

import (
	"reflect"
	"testing"
)

func TestGross(t *testing.T) {
	expenses := []Expense{
		// 1 paid 300: 100 each.
		{PayerID: 1, Shares: []Share{{1, 100}, {2, 100}, {3, 100}}},
		// 2 paid 90 for 1 and 3 only.
		{PayerID: 2, Shares: []Share{{1, 40}, {3, 50}, {2, 0}}},
		// 1 paid again, only for 2.
		{PayerID: 1, Shares: []Share{{2, 20}}},
	}
	got := Gross(expenses)
	want := []Debt{
		{From: 1, To: 2, Amount: 40},
		{From: 2, To: 1, Amount: 120},
		{From: 3, To: 1, Amount: 100},
		{From: 3, To: 2, Amount: 50},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Gross = %+v, want %+v", got, want)
	}
}

func TestNet(t *testing.T) {
	gross := []Debt{
		{From: 1, To: 2, Amount: 40},
		{From: 2, To: 1, Amount: 120},
		{From: 3, To: 1, Amount: 100},
		{From: 3, To: 2, Amount: 50},
		{From: 4, To: 5, Amount: 10},
		{From: 5, To: 4, Amount: 10},
	}
	got := Net(gross)
	want := []Debt{
		{From: 2, To: 1, Amount: 80},
		{From: 3, To: 1, Amount: 100},
		{From: 3, To: 2, Amount: 50},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Net = %+v, want %+v", got, want)
	}
}

func TestEmpty(t *testing.T) {
	if got := Net(Gross(nil)); len(got) != 0 {
		t.Fatalf("expected no debts, got %+v", got)
	}
}
