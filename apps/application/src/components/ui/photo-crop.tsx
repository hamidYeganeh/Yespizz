"use client";
import { Button, Sheet } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
export function PhotoCrop({
  source,
  close,
  apply,
}: {
  source: File;
  close: () => void;
  apply: (value: string) => void;
}) {
  const t = useTranslations("Application.settings");
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<ImageBitmap>();
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50);
  useEffect(() => {
    let ended = false,
      loaded: ImageBitmap | undefined;
    createImageBitmap(source)
      .then((bitmap) => {
        loaded = bitmap;
        if (ended) bitmap.close();
        else setImage(bitmap);
      })
      .catch(() => {
        if (!ended) setError(true);
      });
    return () => {
      ended = true;
      loaded?.close();
    };
  }, [source]);
  useEffect(() => {
    if (!image) return;
    const side = Math.min(image.width, image.height) / zoom;
    canvas.current
      ?.getContext("2d")
      ?.drawImage(
        image,
        ((image.width - side) * x) / 100,
        ((image.height - side) * y) / 100,
        side,
        side,
        0,
        0,
        320,
        320,
      );
  }, [image, zoom, x, y]);
  return (
    <Sheet
      placement="bottom"
      isOpen
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Sheet.Backdrop>
        <Sheet.Content className="mx-auto max-w-(--app-width)">
          <Sheet.Dialog>
            <Sheet.CloseTrigger />
            <Sheet.Header>
              <Sheet.Heading>{t("photo")}</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body className="grid gap-3" data-lenis-prevent>
              <canvas
                aria-label={t("crop")}
                ref={canvas}
                width={320}
                height={320}
                className="mx-auto size-40 rounded-full"
              />
              {error && <p role="alert">{t("photoError")}</p>}
              <label>
                {t("zoomIn")}
                <input
                  className="w-full"
                  type="range"
                  min="1"
                  max="4"
                  step=".05"
                  value={zoom}
                  onChange={(e) => setZoom(+e.target.value)}
                />
              </label>
              <label>
                {t("horizontal")}
                <input
                  className="w-full"
                  type="range"
                  value={x}
                  onChange={(e) => setX(+e.target.value)}
                />
              </label>
              <label>
                {t("vertical")}
                <input
                  className="w-full"
                  type="range"
                  value={y}
                  onChange={(e) => setY(+e.target.value)}
                />
              </label>
            </Sheet.Body>
            <Sheet.Footer>
              <Button
                isDisabled={!image}
                onPress={() => {
                  if (canvas.current) {
                    apply(canvas.current.toDataURL("image/jpeg", 0.9));
                    close();
                  }
                }}
              >
                {t("crop")}
              </Button>
            </Sheet.Footer>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}
