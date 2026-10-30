import { useRef, useState } from "react";
import { IconPhotoPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";

const MAX_BYTES = 1_500_000;
const MAX_SIDE = 1400;

/** The picture is read in the browser; a picture that is too big (in bytes or in pixels) is made smaller, as a JPEG, before it is kept with the question. */
export async function readQuestionImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error("Choose a PNG or a JPEG picture.");
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("The picture could not be read."));
    r.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("The picture could not be read."));
    i.src = url;
  });
  if (file.size <= MAX_BYTES && Math.max(image.width, image.height) <= MAX_SIDE) return url;
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The picture could not be made smaller.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.7, 0.5]) {
    const out = canvas.toDataURL("image/jpeg", quality);
    if (out.length * 0.75 <= MAX_BYTES) return out;
  }
  throw new Error("The picture is too big.");
}

/** A picture under the text of a question of a test (PNG or JPEG). It is drawn in the form APD.0009 under the question. */
export function QuestionImageField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const pick = async (file?: File) => {
    if (!file) return;
    try {
      setError("");
      onChange(await readQuestionImage(file));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="space-y-2">
      <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" aria-label="Question picture" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      {value ? (
        <div className="flex items-start gap-3">
          <img src={value} alt="Picture of the question" className="max-h-40 max-w-xs rounded border border-slate-200 bg-white object-contain" />
          {!disabled && (
            <div className="flex flex-col gap-1">
              <Button size="sm" variant="outline" onClick={() => input.current?.click()}>Change picture</Button>
              <Button size="sm" variant="outline" onClick={() => onChange("")}><IconTrash className="mr-1 h-4 w-4" />Remove picture</Button>
            </div>
          )}
        </div>
      ) : !disabled ? (
        <Button size="sm" variant="outline" onClick={() => input.current?.click()}><IconPhotoPlus className="mr-1 h-4 w-4" />Add a picture</Button>
      ) : null}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
