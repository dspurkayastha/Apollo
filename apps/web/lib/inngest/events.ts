export interface ThesisPhaseApprovedEvent {
  name: "thesis/phase.approved";
  data: {
    projectId: string;
    phaseNumber: number;
    userId: string;
  };
}

export interface ThesisCompileRequestedEvent {
  name: "thesis/compile.requested";
  data: {
    projectId: string;
    userId: string;
    trigger: "manual" | "auto";
  };
}

export interface AnalysisRunRequestedEvent {
  name: "analysis/run.requested";
  data: {
    analysisId: string;
    projectId: string;
    jobId: string;
  };
}

export type ApolloEvent =
  | ThesisPhaseApprovedEvent
  | ThesisCompileRequestedEvent
  | AnalysisRunRequestedEvent;
