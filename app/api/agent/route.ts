export interface Agent {
  id: string;
  name: string;
  department: string;
  isOnline: boolean;
}

export const AGENTS: Agent[] = [
  {
    id: "agent_001",
    name: "خالد",
    department: "الدعم الفني",
    isOnline: true,
  },
  {
    id: "agent_002",
    name: "سارة",
    department: "خدمة العملاء",
    isOnline: true,
  },
  {
    id: "agent_003",
    name: "أحمد",
    department: "الدعم المالي",
    isOnline: false,
  },
];

export function getRandomOnlineAgent() {
  const online = AGENTS.filter(agent => agent.isOnline);

  if (online.length === 0) {
    return AGENTS[0];
  }

  return online[Math.floor(Math.random() * online.length)];
}