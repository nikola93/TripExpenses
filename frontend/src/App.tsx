import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import { client } from "./api";
import type {
  Debt,
  Expense,
  Sheet,
  Traveler,
} from "./gen/tripexpenses/v1/tripexpenses_pb";

const sheetTitle = (s: Sheet) => s.name || `Trošak #${s.id}`;

export default function App() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  // The sheet shown in the main area; null means a new one not created yet.
  const [sheetId, setSheetId] = useState<bigint | null>(null);
  // Set when the current sheet was created in this visit, to offer naming it.
  const [justCreated, setJustCreated] = useState(false);
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [gross, setGross] = useState<Debt[]>([]);
  const [net, setNet] = useState<Debt[]>([]);
  const [error, setError] = useState("");

  const sheet = sheets.find((s) => s.id === sheetId);

  // On first load, open the newest sheet, saved or not.
  useEffect(() => {
    client
      .listSheets({})
      .then((r) => {
        setSheets(r.sheets);
        if (r.sheets.length > 0) setSheetId(r.sheets[0].id);
      })
      .catch((err) => setError(ConnectError.from(err).message));
  }, []);

  const load = useCallback(async (id: bigint | null) => {
    if (id === null) {
      setTravelers([]);
      setExpenses([]);
      setGross([]);
      setNet([]);
      return;
    }
    try {
      const [t, e, b] = await Promise.all([
        client.listTravelers({ sheetId: id }),
        client.listExpenses({ sheetId: id }),
        client.getBalances({ sheetId: id }),
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
    void load(sheetId);
  }, [load, sheetId]);

  // Runs an API call, shows its error if any, then refreshes the sheet's data.
  const run = async (call: () => Promise<unknown>, id = sheetId) => {
    try {
      await call();
    } catch (err) {
      setError(ConnectError.from(err).message);
      return;
    }
    await load(id);
  };

  // Adds a traveler, first creating the sheet if this is a new one.
  const addTraveler = async (name: string) => {
    let id = sheetId;
    if (id === null) {
      try {
        const { sheet } = await client.createSheet({});
        if (!sheet) return;
        id = sheet.id;
        setSheets([sheet, ...sheets]);
        setSheetId(id);
        setJustCreated(true);
      } catch (err) {
        setError(ConnectError.from(err).message);
        return;
      }
    }
    const target = id;
    await run(() => client.createTraveler({ sheetId: target, name }), target);
  };

  const saveSheet = async (name: string) => {
    if (sheetId === null) return;
    try {
      const { sheet: saved } = await client.saveSheet({ id: sheetId, name });
      if (!saved) return;
      setSheets(sheets.map((s) => (s.id === saved.id ? saved : s)));
      setError("");
    } catch (err) {
      setError(ConnectError.from(err).message);
    }
  };

  const openSheet = (id: bigint | null) => {
    setSheetId(id);
    setJustCreated(false);
    setError("");
  };

  const nameOf = (id: bigint) =>
    travelers.find((t) => t.id === id)?.name ?? `#${id}`;

  return (
    <div className="layout">
      <main>
        <h1>Troškovi puta</h1>
        {sheet && (
          <SaveSheet
            key={sheet.id.toString()}
            sheet={sheet}
            autoFocus={justCreated}
            onSave={saveSheet}
          />
        )}
        {error && <p className="error">{error}</p>}
        <Travelers travelers={travelers} onAdd={addTraveler} />
        {travelers.length > 0 && (
          <>
            <Expenses
              travelers={travelers}
              expenses={expenses}
              nameOf={nameOf}
              onAdd={(req) =>
                run(() => client.createExpense({ ...req, sheetId: sheetId! }))
              }
              onDelete={(id) => run(() => client.deleteExpense({ id }))}
            />
            <DueMatrix travelers={travelers} gross={gross} />
            <NetDebts net={net} nameOf={nameOf} />
          </>
        )}
      </main>
      <SavedSheets
        sheets={sheets.filter((s) => s.saved)}
        currentId={sheetId}
        // A draft would be left behind unnamed, so save it before starting another.
        canStartNew={sheetId !== null && sheet?.saved === true}
        onOpen={openSheet}
      />
    </div>
  );
}

function SaveSheet({
  sheet,
  autoFocus,
  onSave,
}: {
  sheet: Sheet;
  autoFocus: boolean;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(sheet.name);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  const upToDate = sheet.saved && name.trim() === sheet.name;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await onSave(name.trim());
  };

  return (
    <form className="save-sheet" onSubmit={submit}>
      <input
        ref={input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Naziv troška (npr. Zlatibor 2026)"
        aria-label="Naziv troška"
      />
      <button type="submit" disabled={upToDate}>
        Sačuvaj trošak
      </button>
      {upToDate && <span className="saved">Sačuvano</span>}
      {!sheet.saved && <span className="draft">Nije sačuvano</span>}
    </form>
  );
}

function SavedSheets({
  sheets,
  currentId,
  canStartNew,
  onOpen,
}: {
  sheets: Sheet[];
  currentId: bigint | null;
  canStartNew: boolean;
  onOpen: (id: bigint | null) => void;
}) {
  return (
    <aside className="sidebar">
      <h2>Sačuvani troškovi</h2>
      <button
        type="button"
        disabled={!canStartNew}
        title={canStartNew ? undefined : "Prvo sačuvaj trenutni trošak"}
        onClick={() => onOpen(null)}
      >
        + Novi trošak
      </button>
      {sheets.length === 0 ? (
        <p className="muted">Još nema sačuvanih troškova.</p>
      ) : (
        <ul>
          {sheets.map((s) => (
            <li key={s.id.toString()}>
              <button
                type="button"
                className={s.id === currentId ? "active" : undefined}
                onClick={() => onOpen(s.id)}
              >
                {sheetTitle(s)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
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
