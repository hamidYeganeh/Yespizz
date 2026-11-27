"use client";
import {
  CheckboxGroup,
  Checkbox,
  Fieldset,
  Label,
  Form,
  Button,
  Input,
  TextField,
} from "@heroui/react";
import { Check, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { groups, type Step, type Profile } from "@/lib/restaurant";
import { saveStep } from "./actions";

const copy = {
  name: [
    "What’s your restaurant called?",
    "Use the name guests see on your door.",
    "Restaurant name",
  ],
  location: [
    "Where’s your restaurant?",
    "Enter the city or town where you serve guests.",
    "City or town",
  ],
  handle: [
    "Choose your restaurant handle",
    "Use 3–30 lowercase letters, numbers or hyphens.",
    "Restaurant handle",
  ],
  specialties: [
    "What do you serve?",
    "Choose the specialties and services that fit your restaurant.",
    "",
  ],
};
export function ProfileStep({
  step,
  profile,
}: {
  step: Step;
  profile: Profile;
}) {
  const [value, setValue] = useState(
    step === "location"
      ? profile.city
      : step === "handle"
        ? profile.handle
        : step === "name"
          ? profile.name
          : "",
  );
  const [choices, setChoices] = useState(profile.specialties);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [title, description, label] = copy[step];
  const handleValid = /^[a-z0-9][a-z0-9-]{2,29}$/.test(value);
  const suggestion = profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return (
    <Form
      className="studio-form"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        start(async () => {
          try {
            const message = await saveStep(
              step,
              step === "specialties" ? choices : value,
            );
            if (message) setError(message);
          } catch (e) {
            if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
            setError("We couldn’t save this step. Try again.");
          }
        });
      }}
    >
      <h1>{title}</h1>
      <p>{description}</p>
      {step === "specialties" ? (
        Object.entries(groups).map(([group, items]) => (
          <Fieldset key={group}>
            <CheckboxGroup
              value={choices.filter((c) => items.some((item) => item === c))}
              onChange={(next) =>
                setChoices([
                  ...choices.filter((c) => !items.some((item) => item === c)),
                  ...next,
                ])
              }
            >
              <Label>{group}</Label>
              {items.map((item) => (
                <Checkbox key={item} value={item}>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Content>{item}</Checkbox.Content>
                </Checkbox>
              ))}
            </CheckboxGroup>
          </Fieldset>
        ))
      ) : (
        <TextField
          aria-label={label}
          value={value}
          onChange={(v) => {
            setValue(v);
            setError("");
          }}
          isRequired
        >
          <Input maxLength={step === "handle" ? 30 : 80} placeholder={label} />
        </TextField>
      )}
      {step === "handle" && value && !handleValid && (
        <small role="status">
          Use a lowercase handle, starting with a letter or number.
        </small>
      )}
      {error && <small role="alert">{error}</small>}
      <Button
        type="submit"
        isPending={pending}
        isDisabled={
          step === "specialties"
            ? !choices.length
            : !value.trim() || (step === "handle" && !handleValid)
        }
      >
        {step === "specialties"
          ? "Finish profile (" + choices.length + ")"
          : "Next"}
      </Button>
      {step === "handle" && suggestion.length >= 3 && (
        <div className="suggestions">
          {[suggestion, suggestion + "-food"].map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              type="button"
              onPress={() => {
                setValue(s);
                setError("");
              }}
            >
              @{s}
            </Button>
          ))}
        </div>
      )}
    </Form>
  );
}
