import React, { Dispatch, SetStateAction, useEffect, useState } from "react";

type travelers = "BANE" | "MARE" | "DJOKA";
const travelersArray: travelers[] = ["BANE", "MARE", "DJOKA"];

interface DueTableProps {
  dueMap: Map<string, number>;
}

function DueTable({ dueMap }: DueTableProps) {
  console.log("rendered");
  return (
    <div style={{ width: "50%", marginTop: "50px" }}>
      <table>
        <tr>
          <th>DUGUJE</th>
          {travelersArray.map((traveler) => {
            return <th>{traveler}</th>;
          })}
        </tr>
        {travelersArray.map((traveler) => {
          return (
            <tr>
              <th>{traveler}</th>
              {travelersArray.map((travelerInner) => {
                if (travelerInner === traveler) {
                  return <th>X</th>;
                }
                const due = dueMap.get(traveler + "_" + travelerInner) ?? 0;
                return <td>{due}</td>;
              })}
            </tr>
          );
        })}
      </table>
    </div>
  );
}

let prevPayee: travelers | undefined;

function ExpenseRow({ setRowCount, index }: ExpenseTableRowProps) {
  const [totalExpense, setTotalExpense] = useState(0);
  const [expenses, setExpenses] = useState<Map<travelers, number>>(
    new Map([
      ["BANE", 0],
      ["MARE", 0],
      ["DJOKA", 0],
    ])
  );

  const [travelersDueMap, setTravelersDueMap] = useState<Map<string, number>>(
    new Map([
      ["BANE_DJOKA", 0],
      ["BANE_MARE", 0],
      ["MARE_BANE", 0],
      ["MARE_DJOKA", 0],
      ["DJOKA_BANE", 0],
      ["DJOKA_MARE", 0],
    ])
  );

  const [payee, setPayee] = useState<travelers>();

  useEffect(() => {
    const bane = expenses.get("BANE") ?? 0;
    const mare = expenses.get("MARE") ?? 0;
    const djoka = expenses.get("DJOKA") ?? 0;
    setTotalExpense(bane + mare + djoka);
  }, [expenses]);

  useEffect(() => {
    if (payee === undefined) {
      return;
    }
    travelersArray.forEach((traveler) => {
      if (traveler !== payee) {
        const money = expenses.get(traveler) ?? 0;
        setTravelersDueMap((prevState) => {
          const newState = new Map(prevState);
          newState.set(traveler + "_" + payee, money);
          if (prevPayee !== undefined && traveler !== prevPayee) {
            newState.set(traveler + "_" + prevPayee, 0);
            newState.set(payee + "_" + prevPayee, 0);
          }
          console.log("PREV/NEW STATE:", newState);
          return newState;
        });
      }
    });

    //Lift up
  }, [payee, expenses]);

  useEffect(() => {
    setRowCount(travelersDueMap, index);
  }, [travelersDueMap]);

  return (
    <tr>
      <td>
        <input type={"text"} />
      </td>
      <td>
        <input
          type={"number"}
          value={expenses.get("BANE") ?? 0}
          onChange={(event) => {
            const parsed = parseInt(event.target.value);
            setExpenses((prevState) => {
              prevState.set("BANE", parsed);
              return new Map<travelers, number>(prevState);
            });
          }}
        />
      </td>
      <td>
        <input
          type={"number"}
          value={expenses.get("MARE") ?? 0}
          onChange={(event) => {
            const parsed = parseInt(event.target.value);
            setExpenses((prevState) => {
              prevState.set("MARE", parsed);
              return new Map<travelers, number>(prevState);
            });
          }}
        />
      </td>
      <td>
        <input
          type={"number"}
          value={expenses.get("DJOKA") ?? 0}
          onChange={(event) => {
            const parsed = parseInt(event.target.value);
            setExpenses((prevState) => {
              prevState.set("DJOKA", parsed);
              return new Map<travelers, number>(prevState);
            });
          }}
        />
      </td>
      <td>
        <label>{totalExpense}</label>
      </td>
      <td>
        <select
          onChange={(event) => {
            const payee = event.target.value as travelers;
            setPayee((prevState) => {
              prevPayee = prevState;
              return payee;
            });
          }}
        >
          <option selected></option>
          {travelersArray.map((traveler) => {
            return <option value={traveler}>{traveler}</option>;
          })}
        </select>
      </td>
    </tr>
  );
}

interface ExpenseTableProps {
  onExpensesTableChange(expenseData: Map<string, number>[]): void;
  dueMap: Map<string, number>;
}

interface ExpenseTableRowProps {
  setRowCount(item: Map<string, number>, index: number): void;
  index: number;
}

function ExpenseTable({ onExpensesTableChange }: ExpenseTableProps) {
  const [rowCount, setRowCount] = useState<Map<string, number>[]>([]);

  const handleRowChange = (item: Map<string, number>, index: number) => {
    setRowCount((prevState) => {
      const newState = new Array(...prevState);
      newState[index] = item;
      console.log("TABLE ROWS", newState);
      return newState;
    });
  };

  useEffect(() => {
    onExpensesTableChange(rowCount);
  }, [rowCount]);

  return (
    <div style={{ width: "50%" }}>
      <table>
        <tr>
          <th>TROSAK/IZNOS</th>
          {travelersArray.map((traveler) => {
            return <th>{traveler}</th>;
          })}
          <th>UKUPNO</th>
          <th>PLATIO</th>
        </tr>
        {rowCount.map((value, index, array) => {
          return <ExpenseRow setRowCount={handleRowChange} index={index} />;
        })}
      </table>
      <button
        onClick={() => {
          setRowCount((prevState) => [...prevState, new Map<string, number>()]);
        }}
      >
        add
      </button>
    </div>
  );
}

function FinalExpenseTable({ dueMap }: DueTableProps) {
  const finalDueMap: Map<string, number> = new Map<string, number>();

  travelersArray.forEach((traveler1) => {
    travelersArray.forEach((traveler2) => {
      if (traveler2 === traveler1) {
        return;
      }
      const money1 = dueMap.get(traveler1 + "_" + traveler2) ?? 0;
      const money2 = dueMap.get(traveler2 + "_" + traveler1) ?? 0;
      if (money1 > money2) {
        finalDueMap.set(traveler1 + "_" + traveler2, money1 - money2);
      } else {
        finalDueMap.set(traveler2 + "_" + traveler1, money2 - money1);
      }
    });
  });

  let rows: JSX.Element[] = [];

  finalDueMap.forEach((value, key) => {
    rows.push(
      <tr>
        <td>{key}</td>
        <td>{value}</td>
      </tr>
    );
  });

  return (
    <div style={{ width: "50%", marginTop: "50px" }}>
      <table>{rows}</table>
    </div>
  );
}

export function TripExpenses() {
  const [travelersDueMap, setTravelersDueMap] = useState<Map<string, number>>(
    new Map([
      ["BANE_DJOKA", 0],
      ["BANE_MARE", 0],
      ["MARE_BANE", 0],
      ["MARE_DJOKA", 0],
      ["DJOKA_BANE", 0],
      ["DJOKA_MARE", 0],
    ])
  );

  const handleExpensesTableChange = (expenseData: Map<string, number>[]) => {
    const dueMap: Map<string, number> = new Map<string, number>([
      ["BANE_DJOKA", 0],
      ["BANE_MARE", 0],
      ["MARE_BANE", 0],
      ["MARE_DJOKA", 0],
      ["DJOKA_BANE", 0],
      ["DJOKA_MARE", 0],
    ]);

    expenseData.forEach((item) => {
      dueMap.forEach((value, key) => {
        const oldValue = dueMap.get(key) ?? 0;
        const itemValue = item.get(key) ?? 0;
        dueMap.set(key, oldValue + itemValue);
      });
    });
    setTravelersDueMap(dueMap);
    console.log("DUE MAP", dueMap);
  };

  return (
    <div>
      <ExpenseTable
        dueMap={travelersDueMap}
        onExpensesTableChange={handleExpensesTableChange}
      />
      <DueTable dueMap={travelersDueMap} />
      <FinalExpenseTable dueMap={travelersDueMap} />
    </div>
  );
}
