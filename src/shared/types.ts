export interface AIConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ResumeStructured {
  name?: string;
  targetRole?: string;
  yearsOfExperience?: number;
  skills: string[];
  highlights: string[];
  projects: Array<{
    name: string;
    summary: string;
  }>;
  rawText?: string;
}

export interface JDStructured {
  title?: string;
  company?: string;
  salary?: string;
  location?: string;
  requirements: string[];
  keywords: string[];
  summary: string;
  rawText?: string;
}
