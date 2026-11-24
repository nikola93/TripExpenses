import { FormEvent, useCallback, useEffect, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import { client } from "./api";
import type {
  Debt,
  Expense,
  Traveler,
} from "./gen/tripexpenses/v1/tripexpenses_pb";

export default function App() {
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [gross, setGross] = useState<Debt[]>([]);
  const [net, setNet] = useState<Debt[]>([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const [t, e, b] = await Promise.all([
        client.listTravelers({}),
        client.listExpenses({}),
        client.getBalances({}),
      ]);
      setTravelers(t.travelers);
      setExpenses(e.expenses);
      setGross(b.gross);
      setNet(b.net);
      setError("");
    } catch (err) {
      setError(ConnectError.from(err).message);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Runs an API call, shows its error if any, then refreshes all data.
  const run = async (call: () => Promise<unknown>) => {
    try {
      await call();
    } catch (err) {
      setError(ConnectError.from(err).message);
      return;
    }
    await reload();
  };

  const nameOf = (id: bigint) =>
    travelers.find((t) => t.id === id)?.name ?? `#${id}`;

  return (
    <main>
      <h1>Troškovi puta</h1>
      {error && <p className="error">{error}</p>}
      <Travelers
        travelers={travelers}
        onAdd={(name) => run(() => client.createTraveler({ name }))}
      />
      {travelers.length > 0 && (
        <>
          <Expenses
            travelers={travelers}
            expenses={expenses}
            nameOf={nameOf}
            onAdd={(req) => run(() => client.createExpense(req))}
            onDelete={(id) => run(() => client.deleteExpense({ id }))}
          />
          <DueMatrix travelers={travelers} gross={gross} />
          <NetDebts net={net} nameOf={nameOf} />
        </>
      )}
    </main>
  );
}

function Travelers({
  travelers,
  onAdd,
}: {
  travelers: Traveler[];
  onAdd: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd(name.trim());
    setName("");
  };

  return (
    <section>
      <h2>Putnici</h2>
      <p>{travelers.map((t) => t.name).join(", ") || "Još nema putnika."}</p>
      <form onSubmit={submit}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ime putnika"
        />
        <button type="submit">Dodaj</button>
      </form>
    </section>
  );
}

interface NewExpense {
  description: string;
  payerId: bigint;
  shares: { travelerId: bigint; amount: bigint }[];
}

function Expenses({
  travelers,
  expenses,
  nameOf,
  onAdd,
  onDelete,
}: {
  travelers: Traveler[];
  expenses: Expense[];
  nameOf: (id: bigint) => string;
  onAdd: (req: NewExpense) => Promise<void>;
  onDelete: (id: bigint) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [payerId, setPayerId] = useState("");

  const parsed = (id: bigint) => {
    const n = parseInt(amounts[id.toString()] ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const newTotal = travelers.reduce((sum, t) => sum + parsed(t.id), 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!payerId) return;
    await onAdd({
      description,
      payerId: BigInt(payerId),
      shares: travelers
        .filter((t) => parsed(t.id) > 0)
        .map((t) => ({ travelerId: t.id, amount: BigInt(parsed(t.id)) })),
    });
    setDescription("");
    setAmounts({});
    setPayerId("");
  };

  const shareOf = (e: Expense, travelerId: bigint) =>
    e.shares.find((s) => s.travelerId === travelerId)?.amount ?? 0n;

  return (
    <section>
      <h2>Troškovi</h2>
      <form onSubmit={submit}>
        <table>
          <thead>
            <tr>
              <th>Trošak</th>
              {travelers.map((t) => (
                <th key={t.id.toString()}>{t.name}</th>
              ))}
              <th>Ukupno</th>
              <th>Platio</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id.toString()}>
                <td>{e.description}</td>
                {travelers.map((t) => (
                  <td key={t.id.toString()}>{shareOf(e, t.id).toString()}</td>
                ))}
                <td>
                  {e.shares.reduce((sum, s) => sum + s.amount, 0n).toString()}
                </td>
                <td>{nameOf(e.payerId)}</td>
                <td>
                  <button type="button" onClick={() => onDelete(e.id)}>
                    Obriši
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opis"
                />
              </td>
              {travelers.map((t) => (
                <td key={t.id.toString()}>
                  <input
                    type="number"
                    min={0}
                    value={amounts[t.id.toString()] ?? ""}
                    onChange={(e) =>
                      setAmounts({ ...amounts, [t.id.toString()]: e.target.value })
                    }
                  />
                </td>
              ))}
              <td>{newTotal}</td>
              <td>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                >
                  <option value="" />
                  {travelers.map((t) => (
                    <option key={t.id.toString()} value={t.id.toString()}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button type="submit" disabled={!payerId}>
                  Dodaj
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </form>
    </section>
  );
}

function DueMatrix({
  travelers,
  gross,
}: {
  travelers: Traveler[];
  gross: Debt[];
}) {
  const due = (from: bigint, to: bigint) =>
    gross.find((d) => d.fromTravelerId === from && d.toTravelerId === to)
      ?.amount ?? 0n;

  return (
    <section>
      <h2>Ko kome duguje (pre prebijanja)</h2>
      <table>
        <thead>
          <tr>
            <th>Duguje ↓ / prima →</th>
            {travelers.map((t) => (
              <th key={t.id.toString()}>{t.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {travelers.map((from) => (
            <tr key={from.id.toString()}>
              <th>{from.name}</th>
              {travelers.map((to) => (
                <td key={to.id.toString()}>
                  {from.id === to.id ? "X" : due(from.id, to.id).toString()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function NetDebts({
  net,
  nameOf,
}: {
  net: Debt[];
  nameOf: (id: bigint) => string;
}) {
  return (
    <section>
      <h2>Konačan obračun</h2>
      {net.length === 0 ? (
        <p>Niko nikome ne duguje.</p>
      ) : (
        <ul>
          {net.map((d) => (
            <li key={`${d.fromTravelerId}-${d.toTravelerId}`}>
              {nameOf(d.fromTravelerId)} duguje {nameOf(d.toTravelerId)}:{" "}
              {d.amount.toString()}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
