"use client";
import { useEffect, useState } from "react";
import { Button, Card } from "@heroui/react";

import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChefHat,
  ChevronRight,
  ClipboardList,
  Menu,
  PanelLeftClose,
  SunMoon,
  Plus,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { initialRecords, sections, type Entry } from "./workspace-data";
import { WorkspaceMap, mockLocations } from "./workspace-map";
import { WorkflowDrawer } from "./workflow-drawer";
import { applyOperation, type Operation } from "./workspace-workflows";
import { RecordTable } from "./workspace-table";
import { WorkspaceEditor } from "./workspace-editor";
import { RecordDetail, designs, recordLink } from "./workspace-views";
import { Overview } from "./workspace-overview";
const icons = {
  Operations: ClipboardList,
  Customers: Users,
  Catalog: ChefHat,
  Growth: Activity,
  Finance: Wallet,
  Insights: BarChart3,
};
export function OperationsWorkspace({
  business = false,
  start = "Overview",
  detail = "",
}: {
  business?: boolean;
  start?: string;
  detail?: string;
}) {
  const [theme, setTheme] = useState(business ? "light" : "dark");
  const [operation, setOperation] = useState<Operation | null>(null);
  const page = start;
  const [records, setRecords] = useState(() => initialRecords(business)),
    [ready, setReady] = useState(false),
    [editor, setEditor] = useState<Entry | null | undefined>(),
    [drawer, setDrawer] = useState(false),
    [message, setMessage] = useState(""),
    [pin, setPin] = useState(0);
  const key = "yespiz-mock-workspace-v1-" + (business ? "business" : "admin");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setRecords({ ...initialRecords(business), ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, [key, business]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === key && event.newValue)
        try {
          setRecords({
            ...initialRecords(business),
            ...JSON.parse(event.newValue),
          });
        } catch {}
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [business, key]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (start === "Follow-ups" && params.has("new")) {
      history.replaceState(null, "", location.pathname);
      setEditor({
        id: crypto.randomUUID(),
        values: [
          "",
          params.get("customer") ?? "",
          "",
          "",
          "Call",
          "Normal",
          params.get("segment") ?? "",
          "",
        ],
        status: "Scheduled",
      });
    }
    if (!location.hash.startsWith("#/")) return;
    try {
      const [name, id] = location.hash
        .slice(2)
        .split("/")
        .map(decodeURIComponent);
      if (
        name &&
        (sections[name] || name === "Dispatch map" || name === "Overview")
      )
        location.replace(recordLink(name, id));
    } catch {}
  }, [start]);
  function open(name: string) {
    location.assign(recordLink(name));
  }
  useEffect(() => {
    const stored = localStorage.getItem(key + "-theme");
    if (stored === "dark" || stored === "light") setTheme(stored);
  }, [key]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);
  const sheet = sections[page],
    rows = records[page] ?? [];
  function save(input: Entry, activity?: string) {
    const previous = rows.find((r) => r.id === input.id);
    const note =
      activity ??
      (!previous
        ? "Created"
        : previous.status !== input.status
          ? previous.status + " → " + input.status
          : (previous.active !== false) !== (input.active !== false)
            ? input.active === false
              ? "Deactivated"
              : "Activated"
            : "Updated details");
    const row = {
      ...input,
      history: [
        { at: new Date().toISOString(), note },
        ...(input.history ?? []),
      ],
    };
    let latest = records;
    try {
      latest = { ...records, ...JSON.parse(localStorage.getItem(key) ?? "{}") };
    } catch {}
    const entries = latest[page] ?? [];
    const next = {
      ...latest,
      [page]: entries.some((r) => r.id === row.id)
        ? entries.map((r) => (r.id === row.id ? row : r))
        : [row, ...entries],
    };
    setRecords(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setEditor(undefined);
      setMessage("Changes last until you close this page.");
      return;
    }
    setEditor(undefined);
    setMessage("Changes saved locally");
  }
  const current = rows.find((r) => r.id === detail);
  const points = records.Orders!;
  const selected = points[pin] ?? points[0];
  function nav(name: string) {
    return (
      <button
        key={name}
        aria-current={page === name ? "page" : undefined}
        onClick={() => open(name)}
      >
        {name}
        <ChevronRight size={13} />
      </button>
    );
  }
  return (
    <div className={"yp-work " + theme} data-theme={theme} data-ready={ready}>
      <aside className={drawer ? "shown" : ""}>
        <div className="yp-brand">
          <span>
            <ChefHat size={23} />
          </span>
          Yespiz
          <button
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="yp-workname">
          <Store size={17} />
          {business ? "Forno Neubau" : "Platform admin"}
        </div>
        <nav>
          {nav("Overview")}
          {nav("Dispatch map")}
          {Object.entries(icons).map(([group, Icon]) => (
            <section key={group}>
              <h3>
                <Icon size={13} />
                {group}
              </h3>
              {Object.values(sections)
                .filter((s) => s.group === group && (!business || s.business))
                .map((s) => nav(s.title))}
            </section>
          ))}
        </nav>
      </aside>
      <main>
        <header>
          <button
            className="yp-mobile"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <span>Workspace</span>
          <ChevronRight size={14} />
          <b>{page}</b>
          <em>Demo workspace</em>
          <button
            aria-label="Switch color theme"
            onClick={() => {
              const next = theme === "dark" ? "light" : "dark";
              localStorage.setItem(key + "-theme", next);
              setTheme(next);
            }}
          >
            <SunMoon size={18} />
          </button>
        </header>
        <article>
          <div className="yp-heading">
            <div>
              <small>
                {business ? "FORNO NEUBAU" : "YESPIZ OPERATIONS"} / VIENNA
              </small>
              <h1>
                {page === "Overview"
                  ? business
                    ? "Kitchen overview"
                    : "Operations overview"
                  : page}
              </h1>
            </div>
            {sheet && !detail && (
              <Button onPress={() => setEditor(null)}>
                <Plus size={16} />
                New {designs[page]!.singular.toLowerCase()}
              </Button>
            )}
          </div>
          {page === "Overview" ? (
            <>
              {business && (
                <div className="studio-shortcuts">
                  {["Orders", "Menu items", "Shift board", "Ingredients"].map(
                    (name) => (
                      <button key={name} onClick={() => open(name)}>
                        {name}
                        <ArrowUpRight size={16} />
                      </button>
                    ),
                  )}
                </div>
              )}
              <Overview records={records} open={open} business={business} />
            </>
          ) : page === "Dispatch map" ? (
            <div className="studio-dispatch">
              <section className="studio-pins">
                <h2>Delivery queue</h2>
                {points.map((r, i) => (
                  <button
                    key={r.id}
                    aria-pressed={selected?.id === r.id}
                    onClick={() => setPin(i)}
                  >
                    <b>{r.values[0]}</b>
                    <small>{r.values[4]}</small>
                  </button>
                ))}
              </section>
              <WorkspaceMap
                locations={mockLocations(points)}
                selected={selected?.id ?? ""}
                choose={(id) => setPin(points.findIndex((r) => r.id === id))}
              />
              {selected && (
                <Card className="yp-card">
                  <h2>
                    {selected.values[0]} · {selected.status}
                  </h2>
                  <p>
                    {selected.values[4]} · Courier {selected.values[5]}
                  </p>
                  <button
                    onClick={() => {
                      location.assign(recordLink("Orders", selected.id));
                    }}
                  >
                    Manage order <ArrowUpRight size={15} />
                  </button>
                </Card>
              )}
            </div>
          ) : detail && sheet ? (
            current ? (
              <RecordDetail
                sheet={sheet}
                row={current}
                records={
                  business
                    ? Object.fromEntries(
                        Object.entries(records).filter(
                          ([p]) => sections[p]?.business,
                        ),
                      )
                    : records
                }
                act={setOperation}
                edit={() => setEditor(current)}
                update={save}
              />
            ) : (
              <a href={recordLink(page)}>
                Record unavailable · Return to {page}
              </a>
            )
          ) : (
            sheet && (
              <>
                <RecordTable
                  sheet={sheet}
                  rows={rows}
                  edit={setEditor}
                  update={save}
                  theme={theme}
                />
              </>
            )
          )}
          <p role="status">{message}</p>
        </article>
      </main>
      {operation && current && (
        <WorkflowDrawer
          theme={theme}
          operation={operation}
          close={() => setOperation(null)}
          commit={(value) => {
            const result = applyOperation(
              page,
              current,
              operation,
              value,
              records,
            );
            save(result.row, result.note);
            setOperation(null);
          }}
        />
      )}
      {editor !== undefined && sheet && (
        <WorkspaceEditor
          sheet={sheet}
          records={records}
          theme={theme}
          row={editor}
          close={() => setEditor(undefined)}
          save={save}
        />
      )}
    </div>
  );
}
