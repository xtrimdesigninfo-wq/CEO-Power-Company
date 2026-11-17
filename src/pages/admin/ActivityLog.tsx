import React, { useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search, Shield, AlertCircle, ArrowRight } from 'lucide-react';
import { AdminActivityLog } from '../../types';
import { dataService } from '../../services/dataService';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getActionBadgeStyle(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('delete') || lower.includes('suspend')) {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  if (lower.includes('create') || lower.includes('insert')) {
    return 'bg-emerald-50 text-[#187004] border-emerald-200';
  }
  if (lower.includes('password') || lower.includes('permission')) {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function formatDiffSummary(details: Record<string, any>): string[] {
  if (!details || typeof details !== 'object') return [];
  const lines: string[] = [];
  if (details.name) lines.push(`Name: ${details.name}`);
  if (details.username) lines.push(`Username: @${details.username}`);
  if (details.ref) lines.push(`Ref: ${details.ref}`);
  if (details.preset) lines.push(`Preset: ${details.preset}`);
  if (typeof details.permissions_count === 'number') {
    lines.push(`Permissions: ${details.permissions_count}`);
  }
  if (details.key) lines.push(`Key: ${details.key}`);
  return lines;
}

export default function ActivityLog() {
  const { error: toastError } = useToast();

  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [migrationWarning, setMigrationWarning] = useState<string | null>(null);

  // Filters
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionSearch, setActionSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const loadLogs = async () => {
    setIsLoading(true);
    setMigrationWarning(null);
    try {
      const data = await dataService.getActivityLogs();
      setLogs(data);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load activity log.';
      if (
        msg.toLowerCase().includes('admin_activity_log') ||
        msg.toLowerCase().includes('does not exist') ||
        msg.toLowerCase().includes('could not find the table')
      ) {
        setMigrationWarning(
          'The admin_activity_log table has not been applied to your Supabase database yet. Run migration 20240103000000_staff_permissions_and_activity.sql in your Supabase SQL Editor.'
        );
      } else {
        toastError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const actorOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    logs.forEach(log => {
      if (log.actor_id) {
        const label = log.actor
          ? `${log.actor.full_name} (@${log.actor.username})`
          : log.actor_id.slice(0, 8);
        map.set(log.actor_id, { id: log.actor_id, label });
      }
    });
    return Array.from(map.values());
  }, [logs]);

  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      if (l.entity) set.add(l.entity);
    });
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (actorFilter !== 'all' && log.actor_id !== actorFilter) return false;
      if (entityFilter !== 'all' && log.entity !== entityFilter) return false;
      if (actionSearch.trim()) {
        const q = actionSearch.toLowerCase().trim();
        const detailsStr = JSON.stringify(log.details || {}).toLowerCase();
        const matches =
          log.action.toLowerCase().includes(q) ||
          log.entity.toLowerCase().includes(q) ||
          (log.entity_id || '').toLowerCase().includes(q) ||
          detailsStr.includes(q);
        if (!matches) return false;
      }
      if (dateFrom) {
        const fromMs = new Date(`${dateFrom}T00:00:00`).getTime();
        if (new Date(log.created_at).getTime() < fromMs) return false;
      }
      if (dateTo) {
        const toMs = new Date(`${dateTo}T23:59:59.999`).getTime();
        if (new Date(log.created_at).getTime() > toMs) return false;
      }
      return true;
    });
  }, [logs, actorFilter, entityFilter, actionSearch, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#187004] mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Super Admin Audit Trail</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            Admin Activity Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Immutable audit log capturing every Super Admin and staff admin mutation, including before/after price and stock changes.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={loadLogs}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </Button>
      </div>

      {migrationWarning && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Database migration required on live Supabase project</p>
            <p className="mt-1 text-amber-800">{migrationWarning}</p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={actionSearch}
            onChange={e => setActionSearch(e.target.value)}
            placeholder="Filter by action, item name, or ID..."
            className="w-full min-h-[40px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#187004]"
          />
        </div>

        <select
          aria-label="Filter by staff actor"
          value={actorFilter}
          onChange={e => setActorFilter(e.target.value)}
          className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#187004]"
        >
          <option value="all">All actors</option>
          {actorOptions.map(a => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by entity"
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
          className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#187004]"
        >
          <option value="all">All entities</option>
          {entityOptions.map(ent => (
            <option key={ent} value={ent}>
              {ent}
            </option>
          ))}
        </select>

        <div className="sm:col-span-2 lg:col-span-2 grid grid-cols-2 gap-2">
          <input
            type="date"
            aria-label="From date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#187004]"
          />
          <input
            type="date"
            aria-label="To date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#187004]"
          />
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm space-y-2">
            <History className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-medium">No activity records match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Actor</th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Entity</th>
                  <th className="px-6 py-3.5">Changes / Before & After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(log => {
                  const summaryLines = formatDiffSummary(log.details);
                  const before = log.details?.before;
                  const after = log.details?.after;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 align-top">
                      <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatTimestamp(log.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        {log.actor ? (
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {log.actor.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              @{log.actor.username} · {log.actor.role}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-slate-400">
                            {log.actor_id ? log.actor_id.slice(0, 8) : 'System'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] font-bold font-mono ${getActionBadgeStyle(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="font-semibold text-slate-800">{log.entity}</span>
                        {log.entity_id && (
                          <div className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]">
                            {log.entity_id}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 space-y-1.5">
                        {summaryLines.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {summaryLines.map((line, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium"
                              >
                                {line}
                              </span>
                            ))}
                          </div>
                        )}

                        {(before || after) && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                            {before && (
                              <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">
                                Before: {JSON.stringify(before)}
                              </span>
                            )}
                            {before && after && <ArrowRight className="w-3 h-3 text-slate-400" />}
                            {after && (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#187004] border border-emerald-100">
                                After: {JSON.stringify(after)}
                              </span>
                            )}
                          </div>
                        )}

                        {summaryLines.length === 0 && !before && !after && log.details && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {JSON.stringify(log.details)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
