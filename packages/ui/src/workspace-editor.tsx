"use client";
import {
  Button,
  Drawer,
  Form,
  Fieldset,
  TextField,
  Label,
  Input,
  TextArea,
  RadioGroup,
  Radio,
  Switch,
  FieldError,
} from "@heroui/react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import {
  additionalFields,
  type Entry,
  type Records,
  type Sheet,
} from "./workspace-data";
import { Choice, EditableChoice, DayField } from "./workspace-fields";
const references: Record<string, string> = {
  Customer: "Users",
  Kitchen: "Kitchens",
  Courier: "Couriers",
  Category: "Categories",
  Menu: "Menus",
  Owner: "Team access",
  Segment: "CRM",
  Order: "Orders",
  Assignee: "Team access",
};
const choices: Record<string, string[]> = {
  "Audience rule": ["One completed order", "Five or more orders"],
  "Discount scope": ["Order", "Product", "Shipping"],
  Combinable: ["Yes", "No"],
  Priority: ["Low", "Normal", "High"],
  Channel: ["Call", "Email", "SMS", "Push"],
  Format: ["CSV", "PDF"],
  "Marketing consent": ["Opted in", "Opted out"],
  "Payment status": ["Pending", "Paid", "Refunded"],
  "Permission level": ["Read", "Edit", "Manage"],
};
export function WorkspaceEditor({
  sheet,
  row,
  records,
  close,
  save,
  theme,
}: {
  sheet: Sheet;
  row: Entry | null;
  records: Records;
  close: () => void;
  save: (r: Entry) => void;
  theme: string;
}) {
  const extra = additionalFields[sheet.title] ?? [],
    labels = [...sheet.fields, ...extra];
  const { control, handleSubmit, setError } = useForm({
    defaultValues: {
      values: labels.map((l, i) => row?.values[i] ?? row?.extra?.[l] ?? ""),
      status: row?.status ?? sheet.states[0]!,
      active: row?.active !== false,
    },
  });
  function submit(data: { values: string[]; status: string; active: boolean }) {
    let bad = false;
    const values = data.values.map((v) => v.trim());
    labels.forEach((label, i) => {
      const v = values[i] ?? "",
        numeric =
          /€|%|Stock|Capacity|Rating|Deliveries|Display order|Target|minutes|quantity|level$|limit$|threshold$|Clicks|Conversions|Attribution days/i.test(
            label,
          ) && label !== "Permission level";
      const required =
        i < sheet.fields.length &&
        !["Reply", "Resolution", "Outcome", "Courier", "Segment"].includes(
          label,
        );
      const msg =
        ["Opening hours", "Serving hours", "Hours"].includes(label) &&
        v &&
        !/^\d{2}:\d{2}–\d{2}:\d{2}$/.test(v.replace("-", "–"))
          ? "Enter both times"
          : required && !v
            ? "Required"
            : v && /email/i.test(label) && !z.email().safeParse(v).success
              ? "Enter a valid email"
              : v &&
                  numeric &&
                  (!z.coerce.number().nonnegative().safeParse(v).success ||
                    (label.includes("%") && +v > 100) ||
                    (label === "Rating" && (+v < 1 || +v > 5)))
                ? "Check the numeric value"
                : label === "End date" &&
                    v &&
                    v < (values[labels.indexOf("Start date")] ?? "")
                  ? "Choose a date after the start"
                  : label === "Outcome" && data.status === "Completed" && !v
                    ? "Record the follow-up outcome"
                    : "";
      if (msg) {
        setError(`values.${i}`, { message: msg });
        bad = true;
      }
    });
    if (!bad)
      save({
        ...row,
        id: row?.id ?? crypto.randomUUID(),
        values: values.slice(0, sheet.fields.length),
        status: data.status,
        active: data.active,
        extra: {
          ...row?.extra,
          ...Object.fromEntries(
            extra.map((l, i) => [l, values[sheet.fields.length + i] ?? ""]),
          ),
        },
      });
  }
  return (
    <Drawer
      isOpen
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Drawer.Backdrop data-theme={theme}>
        <Drawer.Content placement="right">
          <Drawer.Dialog>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>
                {row && records[sheet.title]?.some((r) => r.id === row.id)
                  ? "Edit"
                  : "New"}{" "}
                · {sheet.title}
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <Form
                id="record-editor"
                onSubmit={handleSubmit(submit)}
                validationBehavior="aria"
              >
                <Fieldset>
                  <Fieldset.Legend>Record details</Fieldset.Legend>
                  {labels.map((label, i) => (
                    <Controller
                      key={label}
                      name={`values.${i}`}
                      control={control}
                      render={({ field, fieldState }) => {
                        const value = field.value ?? "",
                          change = field.onChange,
                          ref = i === 0 ? undefined : references[label],
                          options = [
                            ...new Set(
                              [
                                ...(ref ? (records[ref] ?? []) : []).map(
                                  (r) => r.values[0]!,
                                ),
                                ...(records[sheet.title] ?? []).map(
                                  (r) => r.values[i] ?? "",
                                ),
                                value,
                              ].filter(Boolean),
                            ),
                          ];
                        let input;
                        const customError =
                          label.toLowerCase().endsWith("date") ||
                          ["Opening hours", "Serving hours", "Hours"].includes(
                            label,
                          ) ||
                          label === "Priority" ||
                          Boolean(choices[label]) ||
                          Boolean(ref) ||
                          [
                            "Language",
                            "Role",
                            "Audience",
                            "Placement",
                            "Vehicle",
                            "Station",
                            "Zone",
                            "Unit",
                            "Method",
                            "Frequency",
                            "Size",
                          ].includes(label);
                        if (label.toLowerCase().endsWith("date"))
                          input = <DayField {...{ label, value, change }} />;
                        else if (
                          ["Opening hours", "Serving hours", "Hours"].includes(
                            label,
                          )
                        ) {
                          const [start = "", end = ""] = value.split(/[–-]/);
                          input = (
                            <Fieldset>
                              <Fieldset.Legend>{label}</Fieldset.Legend>
                              <TextField
                                type="time"
                                value={start}
                                onChange={(v) => change(v + "–" + end)}
                              >
                                <Label>Start time</Label>
                                <Input />
                              </TextField>
                              <TextField
                                type="time"
                                value={end}
                                onChange={(v) => change(start + "–" + v)}
                              >
                                <Label>End time</Label>
                                <Input />
                              </TextField>
                            </Fieldset>
                          );
                        } else if (label === "Delivery time") {
                          input = (
                            <TextField
                              type="time"
                              value={value}
                              onChange={change}
                            >
                              <Label>{label}</Label>
                              <Input />
                            </TextField>
                          );
                        } else if (label === "Priority")
                          input = (
                            <RadioGroup value={value} onChange={change}>
                              <Label>{label}</Label>
                              {choices.Priority!.map((o) => (
                                <Radio key={o} value={o}>
                                  <Radio.Control>
                                    <Radio.Indicator />
                                  </Radio.Control>
                                  <Radio.Content>{o}</Radio.Content>
                                </Radio>
                              ))}
                            </RadioGroup>
                          );
                        else if (choices[label])
                          input = (
                            <Choice
                              {...{ label, value, change }}
                              options={[
                                ...new Set([...choices[label]!, ...options]),
                              ]}
                            />
                          );
                        else if (
                          ref ||
                          [
                            "Language",
                            "Role",
                            "Audience",
                            "Placement",
                            "Vehicle",
                            "Station",
                            "Zone",
                            "Unit",
                            "Method",
                            "Frequency",
                            "Size",
                          ].includes(label)
                        )
                          input = (
                            <EditableChoice
                              {...{ label, value, change, options }}
                            />
                          );
                        else
                          input = (
                            <TextField
                              name={field.name}
                              value={value}
                              onChange={change}
                              isInvalid={!!fieldState.error}
                            >
                              <Label>{label}</Label>
                              {/instructions|message|reply|resolution|outcome|reason|description/i.test(
                                label,
                              ) ? (
                                <TextArea />
                              ) : (
                                <Input
                                  ref={field.ref}
                                  type={
                                    /€|%|Stock|Capacity|Rating|Deliveries|Display order|Target|minutes|quantity|Reorder level|limit$|threshold$|Clicks|Conversions|Attribution days/i.test(
                                      label,
                                    )
                                      ? "number"
                                      : /email/i.test(label)
                                        ? "email"
                                        : "text"
                                  }
                                  step="any"
                                />
                              )}
                              <FieldError>
                                {fieldState.error?.message}
                              </FieldError>
                            </TextField>
                          );
                        return (
                          <div key={label}>
                            {input}
                            {fieldState.error && customError && (
                              <small role="alert">
                                {fieldState.error.message}
                              </small>
                            )}
                          </div>
                        );
                      }}
                    />
                  ))}
                </Fieldset>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Choice
                      label="Workflow status"
                      value={field.value}
                      options={sheet.states}
                      change={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="active"
                  control={control}
                  render={({ field }) => (
                    <Switch isSelected={field.value} onChange={field.onChange}>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Content>Active record</Switch.Content>
                    </Switch>
                  )}
                />
              </Form>
            </Drawer.Body>
            <Drawer.Footer>
              <Button variant="secondary" onPress={close}>
                Cancel
              </Button>
              <Button type="submit" form="record-editor">
                Save changes
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
