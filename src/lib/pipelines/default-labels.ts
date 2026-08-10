const DEFAULT_PIPELINE_LABELS: Record<string, string> = {
  "Sales Pipeline": "Funil de Vendas",
};

const DEFAULT_STAGE_LABELS: Record<string, string> = {
  "New Lead": "Novo lead",
  Qualified: "Qualificado",
  "Proposal Sent": "Proposta enviada",
  Negotiation: "Negociação",
  Won: "Ganho",
};

export function translateDefaultPipelineLabel(name: string): string {
  return DEFAULT_PIPELINE_LABELS[name] ?? name;
}

export function translateDefaultStageLabel(name: string): string {
  return DEFAULT_STAGE_LABELS[name] ?? name;
}
