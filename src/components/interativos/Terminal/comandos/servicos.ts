/** Nomes de serviço como em /etc/services (usados quando não há -n). */
export const SERVICOS: Record<number, string> = {
  20: 'ftp-data', 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'domain', 67: 'bootps', 68: 'bootpc',
  80: 'http', 110: 'pop3', 123: 'ntp', 143: 'imap2', 161: 'snmp', 443: 'https', 445: 'microsoft-ds',
  631: 'ipp', 993: 'imaps', 3306: 'mysql', 3389: 'ms-wbt-server', 5432: 'postgresql', 8080: 'http-alt',
};

export function nomeServico(porta: number): string {
  return SERVICOS[porta] ?? String(porta);
}
