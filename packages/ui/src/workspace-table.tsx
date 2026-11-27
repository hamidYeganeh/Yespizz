"use client";
import { useMemo, useState } from "react";
import {
  Button,
  Table,
  TextField,
  Label,
  Input,
  CheckboxGroup,
  Checkbox,
  Drawer,
} from "@heroui/react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { Choice, DayField } from "./workspace-fields";
import { additionalFields, type Entry, type Sheet } from "./workspace-data";
import { recordLink } from "./workspace-views";
export function RecordTable({
  sheet,
  rows,
  edit,
  update,
  theme,
}: {
  sheet: Sheet;
  rows: Entry[];
  edit: (r: Entry) => void;
  update: (r: Entry) => void;
  theme: string;
}) {
  const labels = useMemo(
    () => [
      ...sheet.fields,
      ...(additionalFields[sheet.title] ?? []),
      "Status",
      "Activation",
    ],
    [sheet],
  );
  const cell = (r: Entry, l: string) =>
    l === "Status"
      ? r.status
      : l === "Activation"
        ? r.active === false
          ? "Inactive"
          : "Active"
        : (r.values[sheet.fields.indexOf(l)] ?? r.extra?.[l] ?? "");
  const [search, searchFor] = useState(""),
    [filters, filterBy] = useState<Record<string, string>>({}),
    [columns, show] = useState([...sheet.fields, "Status", "Activation"]),
    [drawer, setDrawer] = useState(false),
    [sorting, sort] = useState<SortingState>([]),
    [pagination, paginate] = useState({ pageIndex: 0, pageSize: 10 });
  const [range, setRange] = useState({ field: "", from: "", to: "" });
  const rangeFields = labels.filter((l) =>
    /date$|€|%|Stock|Capacity|Rating|Deliveries|Target|minutes|quantity|limit$/i.test(
      l,
    ),
  );
  const dateRange = range.field.toLowerCase().endsWith("date");
  const inRange = (row: Entry) => {
    if (!range.field || (!range.from && !range.to)) return true;
    const raw = cell(row, range.field);
    if (!raw) return false;
    const v = dateRange ? raw : Number(raw);
    return (
      (!range.from || v >= (dateRange ? range.from : Number(range.from))) &&
      (!range.to || v <= (dateRange ? range.to : Number(range.to)))
    );
  };
  const [queue, setQueue] = useState("All");
  const today = new Date().toLocaleDateString("sv-SE");
  const queueMatch = (r: Entry) =>
    queue === "All" ||
    (queue === "Active orders" &&
      !["Delivered", "Cancelled"].includes(r.status)) ||
    (queue === "Order history" &&
      ["Delivered", "Cancelled"].includes(r.status)) ||
    (queue === "Completed" && r.status === "Completed") ||
    (!["Completed", "Cancelled"].includes(r.status) &&
      ((queue === "Due today" && r.values[3] === today) ||
        (queue === "Overdue" && !!r.values[3] && r.values[3] < today) ||
        (queue === "Upcoming" && r.values[3]! > today)));
  const data = useMemo(
    () =>
      rows.filter(
        (r) =>
          inRange(r) &&
          queueMatch(r) &&
          Object.entries(filters).every(([k, v]) => !v || cell(r, k) === v) &&
          labels.some((l) =>
            cell(r, l).toLowerCase().includes(search.trim().toLowerCase()),
          ),
      ),
    [rows, filters, search, labels, queue, today, range],
  );
  const defs = useMemo(
    () =>
      labels.map((l) => ({
        id: l,
        accessorFn: (r: Entry) => cell(r, l),
        sortingFn: /€|%|Stock|Capacity|Rating|Deliveries|Target/.test(l)
          ? (a: { original: Entry }, b: { original: Entry }) =>
              Number(cell(a.original, l)) - Number(cell(b.original, l))
          : ("alphanumeric" as const),
      })),
    [labels],
  );
  const table = useReactTable({
    columns: defs,
    data,
    state: { sorting, pagination },
    onSortingChange: sort,
    onPaginationChange: paginate,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => r.id,
  });
  const apply = (key: string, v: string) => {
    filterBy((prev) => ({ ...prev, [key]: v === "All" ? "" : v }));
    table.setPageIndex(0);
  };
  const selected = labels.filter((l) => columns.includes(l));
  const activeFilters = Object.values(filters).filter(Boolean).length;
  function exportCsv() {
    const lines = [
      selected,
      ...table
        .getSortedRowModel()
        .rows.map(({ original }) => selected.map((l) => cell(original, l))),
    ];
    const url = URL.createObjectURL(
      new Blob(
        [
          lines
            .map((row) =>
              row.map((v) => '"' + v.replaceAll('"', '""') + '"').join(","),
            )
            .join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = sheet.title + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="record-browser">
      <div className="record-tools">
        <TextField
          value={search}
          onChange={(v) => {
            searchFor(v);
            table.setPageIndex(0);
          }}
        >
          <Label>Search</Label>
          <Input placeholder={"Search " + sheet.title.toLowerCase()} />
        </TextField>
        {["Orders", "Follow-ups"].includes(sheet.title) && (
          <Choice
            label="Queue"
            value={queue}
            options={
              sheet.title === "Orders"
                ? ["All", "Active orders", "Order history"]
                : ["All", "Due today", "Overdue", "Upcoming", "Completed"]
            }
            change={(v) => {
              setQueue(v);
              table.setPageIndex(0);
            }}
          />
        )}
        <Choice
          label="Status"
          value={filters.Status || "All"}
          options={["All", ...sheet.states]}
          change={(v) => apply("Status", v)}
        />
        <Button variant="secondary" onPress={() => setDrawer(true)}>
          Filters & columns{activeFilters ? " · " + activeFilters : ""}
        </Button>
        <Button variant="tertiary" onPress={exportCsv}>
          Export CSV
        </Button>
      </div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content
            aria-label={sheet.title}
            sortDescriptor={
              sorting[0]
                ? {
                    column: sorting[0].id,
                    direction: sorting[0].desc ? "descending" : "ascending",
                  }
                : undefined
            }
            onSortChange={(d) =>
              sort([
                { id: String(d.column), desc: d.direction === "descending" },
              ])
            }
          >
            <Table.Header>
              {[...selected, "Actions"].map((l, i) => (
                <Table.Column
                  key={l}
                  id={l}
                  isRowHeader={i === 0}
                  allowsSorting={l !== "Actions"}
                >
                  {l}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body renderEmptyState={() => "No matching records"}>
              {table.getRowModel().rows.map(({ original: r }) => (
                <Table.Row key={r.id} id={r.id}>
                  {[...selected, "Actions"].map((l) => (
                    <Table.Cell key={l}>
                      {l === "Actions" ? (
                        <div className="record-actions">
                          <a href={recordLink(sheet.title, r.id)}>Details</a>
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => edit(r)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() =>
                              update({ ...r, active: r.active === false })
                            }
                          >
                            {r.active === false ? "Activate" : "Deactivate"}
                          </Button>
                        </div>
                      ) : (
                        cell(r, l) || "—"
                      )}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <div className="record-tools">
        <span>
          {data.length} of {rows.length} records · Page{" "}
          {pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
        </span>
        <Choice
          label="Rows per page"
          value={String(pagination.pageSize)}
          options={["2", "5", "10", "25", "50"]}
          change={(v) => table.setPageSize(Number(v))}
        />
        <Button
          variant="secondary"
          isDisabled={!table.getCanPreviousPage()}
          onPress={() => table.previousPage()}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          isDisabled={!table.getCanNextPage()}
          onPress={() => table.nextPage()}
        >
          Next
        </Button>
      </div>
      <Drawer isOpen={drawer} onOpenChange={setDrawer}>
        <Drawer.Backdrop data-theme={theme}>
          <Drawer.Content placement="right">
            <Drawer.Dialog>
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>
                  Filter {sheet.title.toLowerCase()}
                </Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                <div className="record-stack">
                  {rangeFields.length > 0 && (
                    <>
                      <Choice
                        label="Range filter"
                        value={range.field || "None"}
                        options={["None", ...rangeFields]}
                        change={(v) => {
                          setRange({
                            field: v === "None" ? "" : v,
                            from: "",
                            to: "",
                          });
                          table.setPageIndex(0);
                        }}
                      />
                      {range.field &&
                        (["from", "to"] as const).map((k) => {
                          const change = (v: string) => {
                            setRange((prev) => ({ ...prev, [k]: v }));
                            table.setPageIndex(0);
                          };
                          return dateRange ? (
                            <DayField
                              key={k}
                              label={k}
                              change={change}
                              value={range[k]}
                            />
                          ) : (
                            <TextField
                              key={k}
                              value={range[k]}
                              onChange={change}
                            >
                              <Label>{k}</Label>
                              <Input type="number" />
                            </TextField>
                          );
                        })}
                    </>
                  )}
                  {labels.map((l) => (
                    <Choice
                      searchable
                      key={l}
                      label={l}
                      value={filters[l] || "All"}
                      change={(v) => apply(l, v)}
                      options={[
                        "All",
                        ...new Set(rows.map((r) => cell(r, l)).filter(Boolean)),
                      ]}
                    />
                  ))}
                  <CheckboxGroup
                    value={columns}
                    onChange={(v) => show(v.length ? v : [labels[0]!])}
                  >
                    <Label>Visible columns</Label>
                    {labels.map((l) => (
                      <Checkbox key={l} value={l}>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Content>{l}</Checkbox.Content>
                      </Checkbox>
                    ))}
                  </CheckboxGroup>
                </div>
              </Drawer.Body>
              <Drawer.Footer>
                <Button
                  variant="secondary"
                  onPress={() => {
                    filterBy({});
                    searchFor("");
                    setQueue("All");
                    setRange({ field: "", from: "", to: "" });
                    table.setPageIndex(0);
                  }}
                >
                  Clear filters
                </Button>
                <Button onPress={() => setDrawer(false)}>
                  Show {data.length} records
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </section>
  );
}
