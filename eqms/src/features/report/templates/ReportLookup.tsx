import { useEffect, useState, useRef } from "react";
import { Select } from "@/components/ui/select/Select";
import {
  reportTemplatesApi,
  reportError,
} from "@/services/api/reportTemplates";

/** Search stays on the server. Select receives only the current server result, not an entire register. */
export function ReportLookup({
  code,
  field,
  label,
  value,
  onChange,
}: {
  code: string;
  field: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [items, setItems] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const [chosen, setChosen] = useState<{ value: string; label: string }>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const request = useRef(0);
  const mounted = useRef(true);
  const latestOptions = useRef<Array<{ value: string; label: string }>>([]);
  useEffect(() => {
    let alive = true;
    mounted.current = true;
    const initialRequest = ++request.current;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(
      () =>
        reportTemplatesApi
          .options(code, field, "")
          .then((data) => {
            if (alive && initialRequest === request.current) setItems(data);
          })
          .catch((error) => {
            if (alive && initialRequest === request.current) {
              setItems([]);
              setError(reportError(error));
            }
          })
          .finally(() => {
            if (alive) setLoading(false);
          }),
      250,
    );
    return () => {
      alive = false;
      mounted.current = false;
      request.current++;
      window.clearTimeout(timer);
    };
  }, [code, field]);
  const options = [{ value: "", label: "All" }, ...items];
  if (
    chosen &&
    value === chosen.value &&
    !items.some((item) => item.value === value)
  )
    options.push(chosen);
  latestOptions.current = options;
  return (
    <div className="space-y-2">
      <Select
        key={`${code}:${field}`}
        label={label}
        value={value}
        isLoading={loading}
        options={options}
        searchPlaceholder={`Search ${label.toLowerCase()}...`}
        onSearch={async (query) => {
          const currentRequest = ++request.current;
          try {
            const data = await reportTemplatesApi.options(code, field, query);
            if (!mounted.current || currentRequest !== request.current)
              return latestOptions.current;
            setError("");
            const next = [{ value: "", label: "All" }, ...data];
            if (
              chosen &&
              value === chosen.value &&
              !next.some((item) => item.value === value)
            )
              next.push(chosen);
            setItems(data);
            return next;
          } catch (error) {
            if (!mounted.current || currentRequest !== request.current)
              return latestOptions.current;
            setItems([]);
            setError(reportError(error));
            return [];
          }
        }}
        onChange={(item) => {
          const next = String(item);
          setChosen(options.find((option) => option.value === next));
          onChange(next);
        }}
      />
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          {loading
            ? "Loading…"
            : "Up to 100 scoped matches. Search to find more."}
        </p>
      )}
    </div>
  );
}
