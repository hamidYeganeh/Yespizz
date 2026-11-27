"use client";
import {
  Autocomplete,
  Calendar,
  ComboBox,
  DateField,
  DatePicker,
  Input,
  Label,
  ListBox,
  SearchField,
  Select,
  useFilter,
} from "@heroui/react";
import { I18nProvider } from "react-aria-components";
import { parseDate } from "@internationalized/date";
type Props = {
  label: string;
  value: string;
  options: string[];
  change: (s: string) => void;
};
export function Choice({
  label,
  value,
  options,
  change,
  searchable = false,
}: Props & { searchable?: boolean }) {
  const { contains } = useFilter({ sensitivity: "base" });
  const items = (
    <ListBox>
      {options.map((o) => (
        <ListBox.Item key={o} id={o} textValue={o}>
          {o}
          <ListBox.ItemIndicator />
        </ListBox.Item>
      ))}
    </ListBox>
  );
  if (searchable)
    return (
      <Autocomplete
        value={value || null}
        onChange={(k) => change(String(k ?? ""))}
      >
        <Label>{label}</Label>
        <Autocomplete.Trigger>
          <Autocomplete.Value />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={contains}>
            <SearchField aria-label={"Search " + label}>
              <SearchField.Group>
                <SearchField.Input />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            {items}
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
    );
  return (
    <Select value={value || null} onChange={(k) => change(String(k ?? ""))}>
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>{items}</Select.Popover>
    </Select>
  );
}
export function EditableChoice({ label, value, options, change }: Props) {
  return (
    <ComboBox
      menuTrigger="input"
      allowsCustomValue
      inputValue={value}
      onInputChange={change}
    >
      <Label>{label}</Label>
      <ComboBox.InputGroup>
        <Input />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o} id={o} textValue={o}>
              {o}
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
export function DayField({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: (s: string) => void;
}) {
  return (
    <I18nProvider locale="en-GB-u-ca-gregory">
      <DatePicker
        value={value ? parseDate(value) : null}
        onChange={(d) => change(d?.toString() ?? "")}
      >
        <Label>{label}</Label>
        <DateField.Group>
          <DateField.Input>
            {(seg) => <DateField.Segment segment={seg} />}
          </DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          <Calendar aria-label={label}>
            <Calendar.Header>
              <Calendar.NavButton slot="previous" />
              <Calendar.Heading />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>
                {(day) => <Calendar.Cell date={day} />}
              </Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </I18nProvider>
  );
}
