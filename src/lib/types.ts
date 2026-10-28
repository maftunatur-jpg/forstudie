// Delade typer. Kolumnnamn följer databasen (snake_case) så att rader kan
// sparas oförändrade i både IndexedDB och Postgres.

export type Role = "owner" | "editor" | "viewer";

export type Rating = "good" | "acceptable" | "deficient" | "urgent" | "not_assessed";

export type VisitKind = "apartment" | "premises" | "common";

export type QuestionType = "multi" | "single" | "text" | "number" | "yesno";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
  help?: string;
  warning?: string;
  unit?: string;
}

export interface Section {
  id: string;
  title: string;
  questions: Question[];
}

export interface Template {
  id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  sections: Section[];
  based_on: string | null;
  updated_at: string;
  deleted_at?: string | null;
}

/** Svar lagras som answers[templateId][questionId]. */
export type AnswerValue = string | string[] | number | boolean | null;
export type Answers = Record<string, Record<string, AnswerValue>>;

/** Bedömning per kategori, nyckel `${templateId}:${sectionId}`. */
export type Ratings = Record<string, Rating>;

export interface Project {
  id: string;
  org_id: string;
  name: string;
  property_designation: string | null;
  address: string | null;
  client: string | null;
  study_type: string | null;
  study_date: string | null;
  responsible: string | null;
  level1_name: string;
  level1_values: string[];
  level2_name: string | null;
  level2_values: string[];
  template_ids: string[];
  summary: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Visit {
  id: string;
  project_id: string;
  level1: string | null;
  level2: string | null;
  kind: VisitKind;
  object_number: string | null;
  floor: string | null;
  shaft: string | null;
  visit_date: string | null;
  inspector: string | null;
  answers: Answers;
  ratings: Ratings;
  overall_rating: Rating | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Photo {
  id: string;
  visit_id: string;
  project_id: string;
  storage_path: string;
  category: string | null;
  caption: string | null;
  sort_order: number;
  width: number | null;
  height: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type SyncTable = "projects" | "visits" | "photos" | "templates";
