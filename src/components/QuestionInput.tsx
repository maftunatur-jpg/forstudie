"use client";

import { useEffect, useState } from "react";
import { toggleMulti } from "@/lib/templates/engine";
import type { AnswerValue, Question } from "@/lib/types";
import { Chip, inputClass } from "./ui";

export function QuestionInput({ q, value, onChange, disabled }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; disabled?: boolean }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-semibold">{q.label}</div>
      <Control q={q} value={value} onChange={onChange} disabled={disabled} />
      {q.help && <div className="mt-1.5 text-[12.5px] text-muted">{q.help}</div>}
      {q.warning && <div className="mt-1.5 text-[12.5px] font-medium text-warn">⚠ {q.warning}</div>}
    </div>
  );
}

function Control({ q, value, onChange, disabled }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; disabled?: boolean }) {
  switch (q.type) {
    case "single":
      return (
        <div className="flex flex-wrap gap-1.5">
          {(q.options ?? []).map((o) => (
            <Chip key={o} selected={value === o} disabled={disabled} onClick={() => onChange(value === o ? null : o)}>
              {o}
            </Chip>
          ))}
        </div>
      );
    case "multi":
      return (
        <div className="flex flex-wrap gap-1.5">
          {(q.options ?? []).map((o) => (
            <Chip key={o} selected={Array.isArray(value) && value.includes(o)} disabled={disabled} onClick={() => onChange(toggleMulti(value, o))}>
              {o}
            </Chip>
          ))}
        </div>
      );
    case "yesno":
      return (
        <div className="flex gap-1.5">
          <Chip selected={value === true} disabled={disabled} onClick={() => onChange(value === true ? null : true)}>Ja</Chip>
          <Chip selected={value === false} disabled={disabled} onClick={() => onChange(value === false ? null : false)}>Nej</Chip>
        </div>
      );
    case "number":
      return <NumberInput value={value} onChange={onChange} disabled={disabled} unit={q.unit} />;
    case "text":
      return (
        <textarea
          className={inputClass + " min-h-[84px] resize-y"}
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
      {unit && <span className="text-muted">{unit}</span>}
    </div>
  );
}
