/**
 * Registro de comandos. Para adicionar um novo (ex.: nmap):
 * 1. crie comandos/nmap.ts exportando `export const nmap: Comando = (args, ctx) => ...`
 * 2. importe e inclua no objeto abaixo
 * 3. adicione uma linha em AJUDA (builtins.ts) para aparecer no help
 */
import type { Comando } from '../tipos';
import { builtins } from './builtins';
import { dig } from './dig';
import { ip } from './ip';
import { ping } from './ping';
import { ss } from './ss';
import { tcpdump } from './tcpdump';
import { traceroute } from './traceroute';

export const COMANDOS: Record<string, Comando> = {
  ...builtins,
  ip,
  ss,
  ping,
  traceroute,
  dig,
  tcpdump,
};
