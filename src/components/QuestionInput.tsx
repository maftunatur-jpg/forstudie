"use client";

import { useEffect, useState } from "react";
import { toggleMulti } from "@/lib/templates/engine";
import type { AnswerValue, Question } from "@/lib/types";
import { Chip, inputClass } from "./ui";

export function QuestionInput({ q, value, onChange, disabled }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; disabled?: boolean }) {
  return (
    <div className="py-2">
      <div className="mb-1.5 font-medium text-slate-800">{q.label}</div>
      {q.help && <div className="mb-1.5 text-sm text-slate-500">{q.help}</div>}
      {q.warning && <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-sm font-medium text-amber-900">⚠ {q.warning}</div>}
      <Control q={q} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Control({ q, value, onChange, disabled }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; disabled?: boolean }) {
  switch (q.type) {
    case "single":
      return (
        <div className="flex flex-wrap gap-2">
          {(q.options ?? []).map((o) => (
            <Chip key={o} selected={value === o} disabled={disabled} onClick={() => onChange(value === o ? null : o)}>
              {o}
            </Chip>
          ))}
        </div>
      );
    case "multi":
      return (
        <div className="flex flex-wrap gap-2">
          {(q.options ?? []).map((o) => (
            <Chip key={o} selected={Array.isArray(value) && value.includes(o)} disabled={disabled} onClick={() => onChange(toggleMulti(value, o))}>
              {o}
            </Chip>
          ))}
        </div>
      );
    case "yesno":
      return (
        <div className="flex gap-2">
          <Chip selected={value === true} disabled={disabled} onClick={() => onChange(value === true ? null : true)}>Ja</Chip>
          <Chip selected={value === false} disabled={disabled} onClick={() => onChange(value === false ? null : false)}>Nej</Chip>
        </div>
      );
    case "number":
      return <NumberInput value={value} onChange={onChange} disabled={disabled} unit={q.unit} />;
    case "text":
      return (
        <textarea
          className={inputClass + " min-h-20"}
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function NumberInput({ value, onChange, disabled, unit }: { value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; disabled?: boolean; unit?: string }) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synka med extern ändring
    setText((t) => (Number(t.replace(",", ".")) === value ? t : value === null || value === undefined ? "" : String(value)));
  }, [value]);
  return (
    <div className="flex items-center gap-2">
      <input
        className={inputClass + " max-w-40"}
        inputMode="decimal"
        disabled={disabled}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(",", "."));
          onChange(e.target.value.trim() === "" || !Number.isFinite(n) ? null : n);
        }}
      />
      {unit && <span className="text-slate-600">{unit}</span>}
    </div>
  );
}
