import { Button, Card } from "@heroui/react";
import { type Entry, type Records } from "./workspace-data";
export function Highlights({
  page,
  records,
  edit,
  update,
}: {
  page: string;
  records: Records;
  edit: (r: Entry) => void;
  update: (r: Entry) => void;
}) {
  const rows = records[page] ?? [];
  if (page === "Orders")
    return (
      <div className="yp-highlights">
        {rows
          .filter((r) =>
            ["Received", "Preparing", "Ready", "On route"].includes(r.status),
          )
          .slice(0, 4)
          .map((r) => (
            <Card className="yp-ticket" key={r.id}>
              <small>{r.status}</small>
              <h2>{r.values[0]}</h2>
              <p>{r.values[2]}</p>
              <Button
                size="sm"
                variant="secondary"
                onPress={() =>
                  update({
                    ...r,
                    status:
                      {
                        Received: "Preparing",
                        Preparing: "Ready",
                        Ready: "On route",
                        "On route": "Delivered",
                      }[r.status] ?? r.status,
                  })
                }
              >
                {
                  {
                    Received: "Accept order",
                    Preparing: "Mark ready",
                    Ready: "Dispatch",
                    "On route": "Mark delivered",
                  }[r.status]
                }
              </Button>
            </Card>
          ))}
      </div>
    );
  if (page === "App content" || page === "Ads" || page === "Promotions")
    return (
      <div className="yp-highlights">
        {rows.slice(0, 3).map((r, i) => (
          <button
            className={"yp-promo yp-promo-" + i}
            key={r.id}
            onClick={() => edit(r)}
          >
            <small>
              {r.status} · {r.values[1]}
            </small>
            <strong>
              {page === "App content" ? r.values[2] : r.values[0]}
            </strong>
            <span>
              {page === "Promotions"
                ? r.values[2] + "% off"
                : page === "Ads"
                  ? "€" + r.values[2] + " budget"
                  : r.values[3]}
            </span>
          </button>
        ))}
      </div>
    );
  if (page === "KPI targets")
    return (
      <div className="yp-highlights">
        {rows.map((r) => (
          <Card className="yp-ticket" key={r.id}>
            <small>
              {r.values[3]} · {r.status}
            </small>
            <h2>{r.values[0]}</h2>
            <strong>
              {r.values[1]} {r.values[2]}
            </strong>
            <span>Target</span>
          </Card>
        ))}
      </div>
    );
  if (page === "Reviews")
    return (
      <div className="yp-highlights">
        {rows.slice(0, 3).map((r) => (
          <button className="yp-ticket" key={r.id} onClick={() => edit(r)}>
            <strong>{r.values[3]} / 5</strong>
            <p>{r.values[0]}</p>
            <small>
              {r.values[2]} · {r.values[1]}
            </small>
          </button>
        ))}
      </div>
    );
  return null;
}
