"use client";
import {
  Button,
  Drawer,
  FieldError,
  Form,
  Label,
  TextArea,
  TextField,
  Input,
} from "@heroui/react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { Operation } from "./workspace-workflows";
import { Choice, DayField } from "./workspace-fields";
export function WorkflowDrawer({
  operation,
  theme,
  close,
  commit,
}: {
  operation: Operation;
  theme: string;
  close: () => void;
  commit: (v: string) => void;
}) {
  const { control, handleSubmit, setError } = useForm({
    defaultValues: { value: "" },
  });
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
              <Drawer.Heading>{operation.title}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <Form
                id="workflow-action"
                onSubmit={handleSubmit(({ value }) => {
                  let schema = z.coerce.number().finite();
                  if (operation.minimum !== undefined)
                    schema = schema.min(operation.minimum);
                  if (operation.maximum !== undefined)
                    schema = schema.max(operation.maximum);
                  if (
                    !value.trim() ||
                    (operation.kind === "number" &&
                      !schema.safeParse(value).success)
                  ) {
                    setError("value", {
                      message:
                        operation.kind === "number"
                          ? "Enter an amount between " +
                            (operation.minimum ?? 0) +
                            " and " +
                            (operation.maximum ?? "the supported limit")
                          : "Complete this field",
                    });
                    return;
                  }
                  commit(value.trim());
                })}
              >
                <Controller
                  name="value"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      {operation.kind === "date" ? (
                        <DayField
                          label={operation.field}
                          value={field.value}
                          change={field.onChange}
                        />
                      ) : operation.kind === "choice" ? (
                        <Choice
                          label={operation.field}
                          options={operation.options ?? []}
                          value={field.value}
                          change={field.onChange}
                        />
                      ) : (
                        <TextField
                          value={field.value}
                          onChange={field.onChange}
                          isInvalid={!!fieldState.error}
                        >
                          <Label>{operation.field}</Label>
                          {operation.kind === "number" ? (
                            <Input
                              type="number"
                              step="any"
                              min={operation.minimum}
                              max={operation.maximum}
                            />
                          ) : (
                            <TextArea />
                          )}
                          <FieldError>{fieldState.error?.message}</FieldError>
                        </TextField>
                      )}
                      {fieldState.error &&
                        ["date", "choice"].includes(operation.kind ?? "") && (
                          <p role="alert">{fieldState.error.message}</p>
                        )}
                    </>
                  )}
                />
              </Form>
            </Drawer.Body>
            <Drawer.Footer>
              <Button variant="secondary" onPress={close}>
                Cancel
              </Button>
              <Button type="submit" form="workflow-action">
                {operation.title}
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
