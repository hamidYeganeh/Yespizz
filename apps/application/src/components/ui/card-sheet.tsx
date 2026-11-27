"use client";
import { Button, Input, Sheet } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

export function CardSheet({
  open,
  close,
  save,
}: {
  open: boolean;
  close: () => void;
  save: (lastFour: string) => void;
}) {
  const t = useTranslations("Application.settings");
  return (
    <Sheet
      placement="bottom"
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <Sheet.Backdrop>
        <Sheet.Content className="mx-auto max-w-(--app-width)">
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.CloseTrigger />
            <Sheet.Header>
              <Sheet.Heading>{t("addCard")}</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body className="pb-6" data-lenis-prevent>
              {open && (
                <form
                  className="settings-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const fields = new FormData(event.currentTarget);
                    const [month, year] = String(fields.get("expiry"))
                      .split("/")
                      .map(Number);
                    if (
                      new Date(2000 + year!, month!, 1).getTime() <= Date.now()
                    ) {
                      const input = event.currentTarget.elements.namedItem(
                        "expiry",
                      ) as HTMLInputElement;
                      input.setCustomValidity(t("expiredCard"));
                      input.reportValidity();
                      return;
                    }
                    save(
                      String(fields.get("number")).replace(/ /g, "").slice(-4),
                    );
                    close();
                  }}
                >
                  <label>
                    {t("cardNumber")}
                    <Input
                      autoFocus
                      name="number"
                      required
                      inputMode="numeric"
                      autoComplete="cc-number"
                      pattern="(?:[0-9] ?){12,18}[0-9]"
                      maxLength={23}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      {t("expiration")}
                      <Input
                        required
                        name="expiry"
                        autoComplete="cc-exp"
                        placeholder="MM/YY"
                        maxLength={5}
                        pattern="(0[1-9]|1[012])/[0-9]{2}"
                        onInput={(e) => e.currentTarget.setCustomValidity("")}
                      />
                    </label>
                    <label>
                      CVV
                      <Input
                        required
                        name="cvv"
                        type="password"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        pattern="[0-9]{3,4}"
                        maxLength={4}
                      />
                    </label>
                  </div>
                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button fullWidth type="submit">
                      {t("save")}
                    </Button>
                  </motion.div>
                </form>
              )}
            </Sheet.Body>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}
