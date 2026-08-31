import React, { useMemo, useState } from 'react';
import { Deal, Usuario, isUserCommercial } from '../types';
import { BarChart3, Calendar, TrendingUp, ArrowUpRight, ArrowDownRight, Layers, FileSpreadsheet, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { generateDynamicWeeklyTimeline, parseDateFlexible } from '../utils/periodEngine';
import { baseDuasSemanasData } from '../data/baseDuasSemanasData';

import GlobalPeriodBar from './GlobalPeriodBar';
import { PeriodType } from '../utils/periodEngine';

interface ComparativoSemanalViewProps {
  deals: Deal[];
  comerciais?: Usuario[];
  refDate?: Date;
  onRefDateChange?: (d: Date) => void;
  selectedPeriod?: PeriodType;
  onPeriodTypeChange?: (p: PeriodType) => void;
  selectedComercial?: string;
  onComercialChange?: (c: string) => void;
  selectedEmpresa?: string;
  onEmpresaChange?: (e: string) => void;
  selectedProvincia?: string;
  onProvinciaChange?: (p: string) => void;
  onAddDeal?: (deal: Deal) => void;
  onOpenExcelImport?: () => void;
}

export default function ComparativoSemanalView({
  deals,
  comerciais = [],
  refDate,
  onRefDateChange,
  selectedPeriod,
  onPeriodTypeChange,
  selectedComercial,
  onComercialChange,
  selectedEmpresa,
  onEmpresaChange,
  selectedProvincia,
  onProvinciaChange,
  onAddDeal,
  onOpenExcelImport
}: ComparativoSemanalViewProps) {
  const [metricTab, setMetricTab] = useState<'proposto' | 'aprovado' | 'propostas'>('proposto');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const handleSyncAllReports = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await fetch('/api/sync-all-reports', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncStatusMsg(`✅ ${data.totalDeals} propostas sincronizadas até 24–28 Ago 2026!`);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setSyncStatusMsg(`⚠️ ${data.error || 'Erro na sincronização'}`);
      }
    } catch (e: any) {
      setSyncStatusMsg(`⚠️ Falha ao sincronizar: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Modal para adicionar proposta / registo manual diretamente no Comparativo Semanal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newValor, setNewValor] = useState('');
  const [newValorAprovado, setNewValorAprovado] = useState('');
  const [newEtapa, setNewEtapa] = useState<'proposta_enviada' | 'negociacao' | 'aprovado' | 'fechado' | 'perdido'>('proposta_enviada');
  const [newComercialId, setNewComercialId] = useState(comerciais[0]?.id || 'u9');
  const [newSemana, setNewSemana] = useState('Esta Semana');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const comm = comerciais.find(c => c.id === newComercialId) || comerciais[0] || { id: 'u9', nome: 'David Neto' };
    const valNum = parseFloat(newValor.replace(/\s+/g, '').replace(',', '.')) || 0;
    const valAprovNum = parseFloat(newValorAprovado.replace(/\s+/g, '').replace(',', '.')) || 0;

    const deal: Deal = {
      id: `d_man_${Date.now()}`,
      clienteNome: newClientName || newCompany || 'Cliente Manual',
      empresa: newCompany || newClientName || 'Empresa',
      titulo: newTitle || 'Proposta Comercial Semanal',
      valor: valNum,
      valorAprovado: newEtapa === 'fechado' || newEtapa === 'aprovado' ? (valAprovNum || valNum) : valAprovNum,
      valorPerdido: newEtapa === 'perdido' ? valNum : 0,
      etapa: newEtapa,
      comercialId: comm.id,
      comercialNome: comm.nome,
      prioridade: 'Alta',
      diasAberto: 1,
      semana: newSemana,
      probabilidade: newEtapa === 'fechado' || newEtapa === 'aprovado' ? 100 : 60,
      dataEnvio: new Date().toISOString().split('T')[0]
    };

    if (onAddDeal) {
      onAddDeal(deal);
    }
    setIsAddModalOpen(false);
    setNewClientName('');
    setNewCompany('');
    setNewTitle('');
    setNewValor('');
    setNewValorAprovado('');
  };

  // Combined Deal Source (Prioridade absoluta aos deals reais)
  const allDeals = useMemo(() => {
    if (Array.isArray(deals) && deals.length > 0) {
      return deals;
    }
    try {
      const saved = localStorage.getItem('gpa_deals') || localStorage.getItem('gpa_official_deals');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    // Fallback apenas se não houver nenhum registo em deals nem no localStorage
    const convertedBaseDeals: Deal[] = baseDuasSemanasData.map((p, idx) => {
      let etapa: Deal['etapa'] = 'proposta';
      const st = (p.crmStatus || '').toLowerCase();
      if (st.includes('fechado') || st.includes('aprovado') || st.includes('adjudic')) etapa = 'fechado';
      else if (st.includes('perdid') || st.includes('recus')) etapa = 'perdido';
      else if (st.includes('negoc')) etapa = 'negociacao';
      else if (st.includes('producao')) etapa = 'producao';

      const parseVal = (str?: string) => {
        if (!str) return 0;
        const clean = String(str).replace(/[^\d,-]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
      };

      return {
        id: `base_${idx}`,
        clienteNome: p.cliente || 'Cliente',
        titulo: p.servico || `Proposta ${p.cliente}`,
        valor: parseVal(p.valorProposta),
        valorAprovado: parseVal(p.valorAprovado),
        valorPerdido: parseVal(p.valorPerdido),
        etapa,
        comercialId: 'u9',
        comercialNome: p.gestorComercial || 'Comercial',
        prioridade: p.prioridade || 'Média',
        diasAberto: p.diasEmAberto || 0,
        dataEnvio: p.dataEnvio || '2026-07-27',
        semana: p.semana || '27–31 Jul',
        empresa: p.empresaGroup || 'GPA Angola',
        proximaAcao: p.proximaAcao,
        proximoContacto: p.proximoContacto,
        observacoes: p.observacoes
      };
    });

    return convertedBaseDeals;
  }, [deals]);

  // Dynamic Weekly Timeline generated from all historical proposals + live deals
  const weeklyBuckets = useMemo(() => {
    return generateDynamicWeeklyTimeline(allDeals, comerciais, refDate || new Date());
  }, [allDeals, comerciais, refDate]);

  // Display strictly valid weeks that have proposals/activity or current week, sorted chronologically
  const displayBuckets = useMemo(() => {
    const validBuckets = weeklyBuckets.filter(b => {
      const yr = b.startDate ? b.startDate.getFullYear() : 2026;
      if (yr < 2025 || yr > 2027) return false;
      // Exclude empty future weeks with zero activity to prevent confusing charts
      if (b.isFutureWeek && b.propostasCount === 0 && b.valorProposto === 0 && b.valorAprovado === 0) {
        return false;
      }
      return b.propostasCount > 0 || b.valorProposto > 0 || b.valorAprovado > 0 || b.isCurrentWeek;
    });
    if (validBuckets.length >= 1) {
      return validBuckets;
    }
    return weeklyBuckets.filter(b => b.isCurrentWeek || b.propostasCount > 0);
  }, [weeklyBuckets]);

  // Latest 2 weeks for direct comparison (e.g. 17-21 Ago vs 24-28 Ago)
  const latestTwoWeeks = useMemo(() => {
    const weeksWithData = displayBuckets.filter(b => b.propostasCount > 0 || b.valorProposto > 0);
    if (weeksWithData.length >= 2) {
      return {
        penultimate: weeksWithData[weeksWithData.length - 2],
        ultimate: weeksWithData[weeksWithData.length - 1]
      };
    } else if (displayBuckets.length >= 2) {
      return {
        penultimate: displayBuckets[displayBuckets.length - 2],
        ultimate: displayBuckets[displayBuckets.length - 1]
      };
    }
    return null;
  }, [displayBuckets]);

  // Format currency helpers — formato angolano completo e perceptível: 1.385.100,48 Kz
  const formatKz = (v: number) => {
    if (v === null || v === undefined || isNaN(v) || v === 0) return '0,00 Kz';
    return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' Kz';
  };

  const formatShortKz = (v: number) => {
    if (v === null || v === undefined || isNaN(v) || v === 0) return '0,00 Kz';
    return formatKz(v);
  };

  // Recharts dataset (clean and without phantom future weeks)
  const chartData = useMemo(() => {
    return displayBuckets.map(b => ({
      week: b.label.split(' (')[0] + (b.isCurrentWeek ? ' (ESTA SEMANA)' : ''),
      shortWeek: b.label.split(' (')[0],
      fullLabel: b.label,
      propostas: b.propostasCount,
      valorPropostoM: parseFloat((b.valorProposto / 1000000).toFixed(2)),
      valorAprovadoM: parseFloat((b.valorAprovado / 1000000).toFixed(2)),
      forecastM: parseFloat((b.forecast / 1000000).toFixed(2)),
      status: b.isCurrentWeek ? 'Actual' : b.isFutureWeek ? 'Futura' : 'Passada'
    }));
  }, [displayBuckets]);

  return (
    <div className="w-full space-y-6 font-sans text-gray-900 p-2 sm:p-4">
      
      {/* GLOBAL PERIOD BAR SYNCHRONIZED ACROSS ALL 13 VIEWS */}
      {refDate && onRefDateChange && selectedPeriod && onPeriodTypeChange && (
        <GlobalPeriodBar
          refDate={refDate}
          onRefDateChange={onRefDateChange}
          periodType={selectedPeriod}
          onPeriodTypeChange={onPeriodTypeChange}
          comerciais={comerciais}
          selectedComercial={selectedComercial || 'todos'}
          onComercialChange={onComercialChange || (() => {})}
          selectedEmpresa={selectedEmpresa || 'todas'}
          onEmpresaChange={onEmpresaChange || (() => {})}
          selectedProvincia={selectedProvincia || 'todas'}
          onProvinciaChange={onProvinciaChange || (() => {})}
          currentViewName="Comparativo Semanal"
        />
      )}

      {/* EXCEL TITLE BANNER */}
      <div className="bg-gradient-to-r from-[#1B365D] via-[#0F2942] to-[#1E3A8A] text-white p-5 rounded-xl shadow-lg border border-[#122442] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-gray-950 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
              DINÂMICO & AUTOMÁTICO
            </span>
            <h1 className="text-xl md:text-2xl font-black tracking-wider uppercase font-serif text-white">
              EVOLUÇÃO E COMPARATIVO HISTÓRICO SEMANAL
            </h1>
          </div>
          <p className="text-xs text-blue-200 mt-1 flex items-center gap-2 font-medium">
            <Calendar size={14} className="text-amber-400" />
            <span>Atualizado automaticamente com todas as semanas e ficheiros de Excel, Word e PDF</span>
            <span className="text-blue-400">•</span>
            <span className="font-mono text-emerald-300 font-bold">{weeklyBuckets.length} Semanas Mapeadas</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncAllReports}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
            title="Recarregar e sincronizar relatórios semanais até 24–28 Ago 2026"
          >
            <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""} />
            <span>{isSyncing ? "A Sincronizar..." : "Sincronizar Relatórios (até 28 Ago)"}</span>
          </button>

          {onOpenExcelImport && (
            <button
              onClick={onOpenExcelImport}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Importar Ficheiro Excel</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-2 rounded-lg text-xs font-black transition shadow-md cursor-pointer"
          >
            <Layers size={15} />
            <span>+ Adicionar Registo / Oportunidade</span>
          </button>

          <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg border border-white/20 ml-1">
            <button
              onClick={() => setMetricTab('proposto')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${metricTab === 'proposto' ? 'bg-amber-500 text-gray-950 shadow-sm' : 'text-blue-200 hover:text-white'}`}
            >
              Proposto
            </button>
            <button
              onClick={() => setMetricTab('aprovado')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${metricTab === 'aprovado' ? 'bg-emerald-500 text-white shadow-sm' : 'text-blue-200 hover:text-white'}`}
            >
              Aprovado
            </button>
            <button
              onClick={() => setMetricTab('propostas')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${metricTab === 'propostas' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-200 hover:text-white'}`}
            >
              Nº Propostas
            </button>
          </div>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="bg-emerald-900/90 border border-emerald-500 text-emerald-100 p-3 rounded-lg text-xs font-bold flex items-center justify-between animate-fade-in shadow-md">
          <span>{syncStatusMsg}</span>
          <button onClick={() => setSyncStatusMsg(null)} className="text-emerald-300 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* MODAL MANUAL ADICIONAR REGISTO SEMANAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-blue-900/40 animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <h3 className="text-base font-black text-[#1B365D] uppercase tracking-wide flex items-center gap-2">
                <CheckCircle2 size={18} className="text-amber-500" />
                Adicionar Registo Comercial / Oportunidade Semanal
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Cliente / Nome</label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    placeholder="Ex: Sonangol EP"
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Empresa / Razão Social</label>
                  <input
                    type="text"
                    value={newCompany}
                    onChange={e => setNewCompany(e.target.value)}
                    placeholder="Ex: Sonangol Logística"
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Título da Proposta / Serviço</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Ex: Fornecimento de Equipamentos Tecnológicos"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Valor Proposto (AOA)</label>
                  <input
                    type="text"
                    required
                    value={newValor}
                    onChange={e => setNewValor(e.target.value)}
                    placeholder="Ex: 15.000.000"
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Valor Aprovado (AOA)</label>
                  <input
                    type="text"
                    value={newValorAprovado}
                    onChange={e => setNewValorAprovado(e.target.value)}
                    placeholder="Ex: 15.000.000"
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-mono font-bold text-emerald-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Etapa / Estado</label>
                  <select
                    value={newEtapa}
                    onChange={e => setNewEtapa(e.target.value as any)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="proposta_enviada">Proposta Enviada</option>
                    <option value="negociacao">Em Negociação</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="fechado">Fechado / Ganho</option>
                    <option value="perdido">Perdido / Recusado</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Comercial Responsável</label>
                  <select
                    value={newComercialId}
                    onChange={e => setNewComercialId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {comerciais.filter(isUserCommercial).map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Semana de Atribuição</label>
                <input
                  type="text"
                  value={newSemana}
                  onChange={e => setNewSemana(e.target.value)}
                  placeholder="Ex: Esta Semana ou Semana 33"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-[#1B365D] to-indigo-900 text-white rounded-lg text-xs font-black shadow-md hover:from-blue-900 hover:to-indigo-950 cursor-pointer"
                >
                  Salvar e Atualizar Semanal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRÁFICO RECHARTS DE TENDÊNCIA HISTÓRICA SEMANAL */}
      <div className="bg-white p-5 rounded-xl border border-gray-300 shadow-md space-y-3">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-900" />
            <h2 className="text-sm font-black uppercase text-[#1B365D] tracking-wide">
              Tendência Evolutiva das Semanas ({displayBuckets.length} Semanas Exibidas)
            </h2>
          </div>
          <span className="text-xs text-gray-500 font-mono font-semibold">Valores em Milhões de AOA / Kz</span>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="week" stroke="#475569" tick={{ fontSize: 10, fontWeight: 'bold' }} interval={0} angle={-15} textAnchor="end" />
              <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F2942', borderRadius: '8px', border: '1px solid #1E3A8A', color: '#FFF', fontSize: '12px' }}
                formatter={(val: any, name: any) => [
                  name === 'propostas' ? `${val} propostas` : `${val}M AOA`,
                  name === 'valorPropostoM' ? 'Valor Proposto' : name === 'valorAprovadoM' ? 'Receita Aprovada' : name === 'forecastM' ? 'Forecast' : 'Propostas'
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              {metricTab === 'proposto' && <Bar dataKey="valorPropostoM" name="Valor Proposto (M AOA)" fill="#2563EB" radius={[4, 4, 0, 0]} />}
              {metricTab === 'aprovado' && <Bar dataKey="valorAprovadoM" name="Receita Aprovada (M AOA)" fill="#10B981" radius={[4, 4, 0, 0]} />}
              {metricTab === 'propostas' && <Bar dataKey="propostas" name="Quantidade de Propostas" fill="#F59E0B" radius={[4, 4, 0, 0]} />}
              <Bar dataKey="forecastM" name="Forecast Ponderado (M AOA)" fill="#8B5CF6" radius={[4, 4, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABELA DINÂMICA DE COMPARATIVO SEMANAL COMPLETO */}
      <div className="bg-white border border-gray-300 shadow-md rounded-xl overflow-hidden">
        <div className="bg-[#1B365D] text-white p-3.5 flex items-center justify-between">
          <span className="text-xs md:text-sm font-black font-serif uppercase tracking-wider">
            📋 Tabela Consolidada de Comparativo Histórico Semanal (Dinâmica)
          </span>
          <span className="text-[11px] text-blue-200 font-mono font-semibold">
            Todas as Semanas Registadas no Sistema
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-800 text-white uppercase text-[10px] tracking-wider border-b border-slate-700">
                <th className="p-3 font-bold border-r border-slate-700">Indicador CRM</th>
                {displayBuckets.map((b) => (
                  <th
                    key={b.weekKey}
                    className={`p-2.5 text-center font-bold border-r border-slate-700 ${
                      b.isCurrentWeek ? 'bg-emerald-700 text-white font-black' : b.isFutureWeek ? 'bg-purple-900 text-purple-100' : ''
                    }`}
                  >
                    <div>{b.label.split(' (')[0]}</div>
                    <span className="text-[9px] text-slate-300 font-normal font-mono block">
                      {b.isCurrentWeek ? 'ESTA SEMANA' : b.isFutureWeek ? 'FUTURA' : 'PASSADA'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-sans text-gray-900">
              
              {/* Linha 1: N.º de Propostas */}
              <tr className="hover:bg-blue-50/50 transition-colors">
                <td className="p-3 font-bold text-gray-900 border-r border-gray-200 bg-slate-50">N.º de propostas</td>
                {displayBuckets.map((b) => (
                  <td key={b.weekKey} className="p-2.5 text-center font-mono font-bold border-r border-gray-200">
                    {b.propostasCount}
                  </td>
                ))}
              </tr>

              {/* Linha 2: Valor Total Proposto */}
              <tr className="hover:bg-blue-50/50 transition-colors bg-blue-50/20">
                <td className="p-3 font-bold text-gray-900 border-r border-gray-200 bg-slate-50">Valor total proposto</td>
                {displayBuckets.map((b) => (
                  <td key={b.weekKey} className="p-2.5 text-right font-mono font-bold text-blue-900 border-r border-gray-200">
                    {formatShortKz(b.valorProposto)}
                  </td>
                ))}
              </tr>

              {/* Linha 3: Valor Aprovado */}
              <tr className="hover:bg-blue-50/50 transition-colors">
                <td className="p-3 font-bold text-gray-900 border-r border-gray-200 bg-slate-50">Valor aprovado / ganho</td>
                {displayBuckets.map((b) => (
                  <td key={b.weekKey} className="p-2.5 text-right font-mono font-bold text-emerald-700 border-r border-gray-200">
                    {formatShortKz(b.valorAprovado)}
                  </td>
                ))}
              </tr>

              {/* Linha 4: Valor Perdido */}
              <tr className="hover:bg-blue-50/50 transition-colors bg-slate-50/50">
                <td className="p-3 font-bold text-gray-900 border-r border-gray-200 bg-slate-50">Valor perdido / recusado</td>
                {displayBuckets.map((b) => (
                  <td key={b.weekKey} className="p-2.5 text-right font-mono text-rose-600 border-r border-gray-200">
                    {formatShortKz(b.valorPerdido)}
                  </td>
                ))}
              </tr>

              {/* Linha 5: Forecast Ponderado */}
              <tr className="hover:bg-blue-50/50 transition-colors">
                <td className="p-3 font-bold text-gray-900 border-r border-gray-200 bg-slate-50">Forecast ponderado</td>
                {displayBuckets.map((b) => (
                  <td key={b.weekKey} className="p-2.5 text-right font-mono font-bold text-amber-700 border-r border-gray-200">
                    {formatShortKz(b.forecast)}
                  </td>
                ))}
              </tr>

              {/* Linha 6: Taxa de Conversão */}
              <tr className="hover:bg-blue-50/50 transition-colors bg-blue-50/20">
                <td className="p-3 font-bold text-gray-900 border-r border-gray-200 bg-slate-50">Taxa de conversão (%)</td>
                {displayBuckets.map((b) => (
                  <td key={b.weekKey} className="p-2.5 text-center font-mono font-bold text-blue-950 border-r border-gray-200">
                    {b.conversaoPct.toFixed(1)}%
                  </td>
                ))}
              </tr>

              {/* Linha 7: Variação % vs Semana Anterior */}
              <tr className="hover:bg-blue-50/50 transition-colors bg-slate-100">
                <td className="p-3 font-bold text-gray-900 border-r border-gray-200 bg-slate-200">Variação % Aprovado</td>
                {displayBuckets.map((b) => (
                  <td key={b.weekKey} className="p-2.5 text-center font-mono font-bold border-r border-gray-200">
                    <span className={b.variacaoAprovadoPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                      {b.variacaoAprovadoPct >= 0 ? `+${b.variacaoAprovadoPct.toFixed(1)}%` : `${b.variacaoAprovadoPct.toFixed(1)}%`}
                    </span>
                  </td>
                ))}
              </tr>

            </tbody>
          </table>
        </div>
      </div>

      {/* CAMPO EXCLUSIVO DE COMPARATIVO DAS DUAS ÚLTIMAS SEMANAS */}
      {latestTwoWeeks && (
        <div className="bg-gradient-to-r from-[#1B365D] to-[#0F2342] text-white p-5 rounded-xl border border-[#122442] shadow-lg font-sans space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-blue-800/80 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-gray-950 font-black px-2 py-0.5 rounded text-[10px] uppercase font-mono">
                CAMPO EXCLUSIVO
              </span>
              <h3 className="text-base md:text-lg font-black tracking-wide uppercase font-serif text-amber-300">
                COMPARATIVO DIRETO DAS DUAS ÚLTIMAS SEMANAS
              </h3>
            </div>
            <span className="text-xs text-blue-200 font-mono">
              {latestTwoWeeks.penultimate.label} vs {latestTwoWeeks.ultimate.label}
            </span>
          </div>

          <div className="overflow-x-auto bg-white rounded-lg text-gray-900 shadow-inner border border-gray-200">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[#1B365D] font-bold border-b border-gray-300">
                  <th className="p-3 border-r border-gray-200">Indicador</th>
                  <th className="p-3 border-r border-gray-200 text-right">{latestTwoWeeks.penultimate.label.split(' (')[0]}</th>
                  <th className="p-3 border-r border-gray-200 text-right">{latestTwoWeeks.ultimate.label.split(' (')[0]}</th>
                  <th className="p-3 border-r border-gray-200 text-center">Variação</th>
                  <th className="p-3">Leitura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                
                {(() => {
                  const p1 = latestTwoWeeks.penultimate;
                  const p2 = latestTwoWeeks.ultimate;

                  const calcVar = (v1: number, v2: number) => v1 > 0 ? ((v2 - v1) / v1) * 100 : (v2 > 0 ? 100 : 0);
                  const formatPct = (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(1).replace('.', ',')}%`;
                  const formatAOA = (val: number) => new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' AOA';

                  const rows = [
                    {
                      ind: 'N.º de propostas',
                      v1: p1.propostasCount,
                      v2: p2.propostasCount,
                      var: calcVar(p1.propostasCount, p2.propostasCount),
                      isMoney: false,
                      leitura: (v: number) => v > 0 ? 'Mais propostas' : v < 0 ? 'Menos propostas' : 'Igual'
                    },
                    {
                      ind: 'Valor total',
                      v1: p1.valorProposto,
                      v2: p2.valorProposto,
                      var: calcVar(p1.valorProposto, p2.valorProposto),
                      isMoney: true,
                      leitura: (v: number) => v > 0 ? 'Crescimento' : v < 0 ? 'Redução' : 'Igual'
                    },
                    {
                      ind: 'Valor aprovado',
                      v1: p1.valorAprovado,
                      v2: p2.valorAprovado,
                      var: calcVar(p1.valorAprovado, p2.valorAprovado),
                      isMoney: true,
                      leitura: (v: number) => v > 0 ? 'Melhoria' : v < 0 ? 'Queda' : 'Igual'
                    },
                    {
                      ind: 'Valor perdido',
                      v1: p1.valorPerdido,
                      v2: p2.valorPerdido,
                      var: calcVar(p1.valorPerdido, p2.valorPerdido),
                      isMoney: true,
                      leitura: (v: number) => v > 0 ? 'Piora: aumentou' : v < 0 ? 'Melhoria: reduziu' : 'Igual'
                    },
                    {
                      ind: 'Forecast',
                      v1: p1.forecast,
                      v2: p2.forecast,
                      var: calcVar(p1.forecast, p2.forecast),
                      isMoney: true,
                      leitura: (v: number) => v > 0 ? 'Melhoria' : v < 0 ? 'Queda' : 'Igual'
                    },
                    {
                      ind: 'Conversão',
                      v1: p1.conversaoPct,
                      v2: p2.conversaoPct,
                      var: p2.conversaoPct - p1.conversaoPct,
                      isMoney: false,
                      isPct: true,
                      leitura: (v: number) => v > 0 ? 'Aumento' : v < 0 ? 'Redução' : 'Igual'
                    },
                    {
                      ind: 'Ticket médio',
                      v1: p1.propostasCount > 0 ? p1.valorProposto / p1.propostasCount : 0,
                      v2: p2.propostasCount > 0 ? p2.valorProposto / p2.propostasCount : 0,
                      var: calcVar(p1.propostasCount > 0 ? p1.valorProposto / p1.propostasCount : 0, p2.propostasCount > 0 ? p2.valorProposto / p2.propostasCount : 0),
                      isMoney: true,
                      leitura: (v: number) => v > 0 ? 'Aumento' : v < 0 ? 'Redução' : 'Igual'
                    }
                  ];

                  return rows.map((r, i) => (
                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                      <td className="p-3 border-r border-gray-200 font-medium">{r.ind}</td>
                      <td className="p-3 border-r border-gray-200 text-right">
                        {r.isMoney ? formatAOA(r.v1) : r.isPct ? `${Math.round(r.v1)}%` : r.v1}
                      </td>
                      <td className="p-3 border-r border-gray-200 text-right font-bold text-blue-900">
                        {r.isMoney ? formatAOA(r.v2) : r.isPct ? `${Math.round(r.v2)}%` : r.v2}
                      </td>
                      <td className={`p-3 border-r border-gray-200 text-center font-bold ${r.ind === 'Valor perdido' ? (r.var > 0 ? 'text-red-600' : 'text-emerald-600') : (r.var > 0 ? 'text-emerald-600' : 'text-red-600')}`}>
                        {formatPct(r.var)}
                      </td>
                      <td className="p-3 font-medium text-gray-700">
                        {r.leitura(r.var)}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* =====================================================================
          TABELA DETALHADA DE PROPOSTAS — ESTRUTURA DOS RELATÓRIOS REAIS GPA
          Idêntica à tabela "Comparativo Semanal" dos ficheiros de referência
         ===================================================================== */}
      <div className="bg-white border border-gray-300 shadow-md rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#1B365D] to-[#0F2342] text-white p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <span className="bg-amber-500 text-gray-950 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mr-2">
              RELATÓRIO REAL GPA
            </span>
            <span className="text-sm md:text-base font-black font-serif uppercase tracking-wider text-white">
              📋 Tabela Detalhada de Propostas Comerciais
            </span>
            <p className="text-[11px] text-blue-200 mt-1 font-medium">
              Estrutura idêntica aos relatórios semanais oficiais — todas as propostas registadas no sistema
            </p>
          </div>
          <span className="text-[11px] text-blue-200 font-mono font-semibold bg-blue-900/40 px-3 py-1 rounded-full border border-blue-700">
            {allDeals.length} Propostas Totais
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-[#1B365D] text-white uppercase text-[9px] tracking-wider border-b border-blue-900">
                <th className="p-2.5 font-bold border-r border-blue-800 text-center w-10">N.º</th>
                <th className="p-2.5 font-bold border-r border-blue-800">Empresa / Entidade</th>
                <th className="p-2.5 font-bold border-r border-blue-800">Produto / Serviço</th>
                <th className="p-2.5 font-bold border-r border-blue-800">Gestor Comercial</th>
                <th className="p-2.5 font-bold border-r border-blue-800 text-right">Valor de Proposta (Kz)</th>
                <th className="p-2.5 font-bold border-r border-blue-800 text-right">Valor Aprovado (Kz)</th>
                <th className="p-2.5 font-bold border-r border-blue-800 text-center">Estado da Proposta</th>
                <th className="p-2.5 font-bold text-center">Semana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-sans text-gray-900">
              {allDeals.slice(0, 50).map((deal, idx) => {
                const etapa = (deal.etapa || '').toLowerCase();
                const estadoLabel =
                  etapa === 'fechado' ? 'Aprovada / Adjudicada' :
                  etapa === 'perdido' ? 'Perdida / Recusada' :
                  etapa === 'negociacao' ? 'Em Negociação' :
                  etapa === 'producao' ? 'Em Produção' :
                  etapa === 'visita' ? 'Visita / Reunião' :
                  etapa === 'lead' ? 'Lead / Prospecção' :
                  'Proposta Enviada / Em Análise';
                const estadoCor =
                  etapa === 'fechado' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  etapa === 'perdido' ? 'bg-red-100 text-red-800 border-red-300' :
                  etapa === 'negociacao' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                  etapa === 'producao' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                  'bg-blue-50 text-blue-800 border-blue-200';

                return (
                  <tr key={deal.id} className={`hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="p-2.5 text-center font-mono font-bold text-gray-500 border-r border-gray-200">
                      {idx + 1}
                    </td>
                    <td className="p-2.5 font-bold text-gray-900 border-r border-gray-200 max-w-[180px]">
                      <span className="block truncate" title={deal.empresa || deal.clienteNome}>
                        {deal.empresa || deal.clienteNome || '—'}
                      </span>
                    </td>
                    <td className="p-2.5 text-gray-700 border-r border-gray-200 max-w-[200px]">
                      <span className="block truncate" title={deal.titulo}>
                        {deal.titulo || '—'}
                      </span>
                    </td>
                    <td className="p-2.5 font-medium text-[#1B365D] border-r border-gray-200">
                      {deal.comercialNome || '—'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-blue-900 border-r border-gray-200">
                      {Number(deal.valor) > 0 ? formatKz(Number(deal.valor)) : '—'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-700 border-r border-gray-200">
                      {Number(deal.valorAprovado) > 0 ? formatKz(Number(deal.valorAprovado)) : '—'}
                    </td>
                    <td className="p-2.5 text-center border-r border-gray-200">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${estadoCor}`}>
                        {estadoLabel}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-mono text-xs text-gray-600">
                      {deal.semana || '—'}
                    </td>
                  </tr>
                );
              })}
              {allDeals.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400 italic">
                    Nenhuma proposta registada. Importe um ficheiro Excel para preencher esta tabela.
                  </td>
                </tr>
              )}
            </tbody>
            {allDeals.length > 50 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-gray-300">
                  <td colSpan={8} className="p-3 text-center text-xs text-gray-500 font-medium italic">
                    A mostrar 50 de {allDeals.length} propostas. Use os filtros acima para refinar a pesquisa.
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Rodapé de Totais */}
        <div className="bg-[#1B365D] text-white p-3 flex flex-wrap gap-4 text-xs font-mono">
          <span className="font-bold">
            TOTAL PROPOSTAS: <span className="text-amber-300">{allDeals.length}</span>
          </span>
          <span className="text-blue-200">|</span>
          <span className="font-bold">
            VALOR TOTAL PROPOSTO: <span className="text-cyan-300">{formatKz(allDeals.reduce((s, d) => s + Number(d.valor || 0), 0))}</span>
          </span>
          <span className="text-blue-200">|</span>
          <span className="font-bold">
            VALOR TOTAL APROVADO: <span className="text-emerald-300">{formatKz(allDeals.reduce((s, d) => s + Number(d.valorAprovado || 0), 0))}</span>
          </span>
          <span className="text-blue-200">|</span>
          <span className="font-bold">
            VALOR PERDIDO: <span className="text-red-300">{formatKz(allDeals.reduce((s, d) => s + Number(d.valorPerdido || 0), 0))}</span>
          </span>
        </div>
      </div>

      {/* =====================================================================
          GRÁFICO: COMPARATIVO POR GESTOR COMERCIAL (Semana Anterior vs Finda)
          Baseado nos relatórios reais GPA — pasta 10-14 Ago a 17-21 Ago
         ===================================================================== */}
      {comerciais && comerciais.length > 0 && (() => {
        // Build per-commercial data for the 2 most recent weeks with data
        const weeksWithData = weeklyBuckets.filter(b => b.propostasCount > 0 || b.valorProposto > 0);
        const semAnterior = weeksWithData.length >= 2 ? weeksWithData[weeksWithData.length - 2] : null;
        const semFinda = weeksWithData.length >= 1 ? weeksWithData[weeksWithData.length - 1] : null;

        const comerciaisLabels = [...new Set(allDeals.map(d => d.comercialNome || 'Sem atribuição'))].filter(Boolean).slice(0, 8);

        const isDealInWeek = (d: Deal, b: any) => {
          if (!b) return false;
          const dDate = parseDateFlexible(d.dataEnvio) || parseDateFlexible(d.semana);
          if (!dDate) return false;
          const start = b.startDate ? new Date(b.startDate).getTime() : 0;
          const end = b.endDate ? new Date(b.endDate).getTime() + (2 * 86400000) : 0; // extend to Sunday
          return dDate.getTime() >= start && dDate.getTime() <= end;
        };

        const chartDataComercial = comerciaisLabels.map(nome => {
          const dealsComercial = allDeals.filter(d => (d.comercialNome || '').toLowerCase().includes(nome.toLowerCase().split(' ')[0]));
          const dealsAnterior = semAnterior ? dealsComercial.filter(d => isDealInWeek(d, semAnterior)) : [];
          const dealsFinda = semFinda ? dealsComercial.filter(d => isDealInWeek(d, semFinda)) : [];

          return {
            nome: nome.split(' ')[0] + (nome.split(' ')[1] ? ' ' + nome.split(' ')[1] : ''),
            nomeCompleto: nome,
            propostasAnterior: dealsAnterior.length,
            propostasFinda: dealsFinda.length,
            valorAnterior: dealsAnterior.reduce((s, d) => s + Number(d.valor || 0), 0),
            valorFinda: dealsFinda.reduce((s, d) => s + Number(d.valor || 0), 0),
            aprovadoAnterior: dealsAnterior.reduce((s, d) => s + Number(d.valorAprovado || 0), 0),
            aprovadoFinda: dealsFinda.reduce((s, d) => s + Number(d.valorAprovado || 0), 0),
          };
        });

        const labelAnterior = semAnterior ? semAnterior.label.split(' (')[0] : '17–21 Ago 2026';
        const labelFinda = semFinda ? semFinda.label.split(' (')[0] : '24–28 Ago 2026';

        return (
          <div className="bg-white p-5 rounded-xl border border-gray-300 shadow-md space-y-3">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-gray-200 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-700" />
                <h2 className="text-sm font-black uppercase text-[#1B365D] tracking-wide">
                  Comparativo Semanal por Gestor Comercial
                </h2>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 font-bold text-slate-600">
                  <span className="w-3 h-3 rounded bg-slate-500 inline-block"></span>
                  {labelAnterior}
                </span>
                <span className="flex items-center gap-1 font-bold text-blue-700">
                  <span className="w-3 h-3 rounded bg-blue-600 inline-block"></span>
                  {labelFinda}
                </span>
                <span className="flex items-center gap-1 font-bold text-emerald-700">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
                  Aprovado (Semana Finda)
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 italic">
              Análise de volume por Gestor Comercial — Semana Anterior vs Semana Finda (Valor de Proposta em Kz)
            </p>

            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataComercial} margin={{ top: 20, right: 20, left: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="nome" stroke="#475569" tick={{ fontSize: 11, fontWeight: 'bold' }} interval={0} angle={-10} textAnchor="end" />
                  <YAxis stroke="#475569" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F2942', borderRadius: '8px', border: '1px solid #1E3A8A', color: '#FFF', fontSize: '11px' }}
                    formatter={(val: any, name: any) => [
                      typeof val === 'number' && val > 100 ? new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' Kz' : String(val),
                      name === 'valorAnterior' ? `Valor Proposta — ${labelAnterior}` :
                      name === 'valorFinda' ? `Valor Proposta — ${labelFinda}` :
                      name === 'aprovadoFinda' ? `Receita Aprovada — ${labelFinda}` : name
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    formatter={(val) =>
                      val === 'valorAnterior' ? `Valor Proposto (${labelAnterior})` :
                      val === 'valorFinda' ? `Valor Proposto (${labelFinda})` :
                      val === 'aprovadoFinda' ? `Receita Aprovada (${labelFinda})` : val
                    }
                  />
                  <Bar dataKey="valorAnterior" name="valorAnterior" fill="#64748b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="valorFinda"    name="valorFinda"    fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="aprovadoFinda" name="aprovadoFinda" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela de síntese por comercial */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg mt-2">
              <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#1B365D] text-white uppercase text-[9px] tracking-wider">
                    <th className="p-2.5 font-bold border-r border-blue-800">Gestor Comercial</th>
                    <th className="p-2.5 font-bold border-r border-blue-800 text-right">Val. Proposta {labelAnterior}</th>
                    <th className="p-2.5 font-bold border-r border-blue-800 text-right">Val. Proposta {labelFinda}</th>
                    <th className="p-2.5 font-bold border-r border-blue-800 text-right">Receita Aprovada {labelFinda}</th>
                    <th className="p-2.5 font-bold text-center">Variação Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-sans text-gray-900">
                  {chartDataComercial.map((row, i) => {
                    const varPct = row.valorAnterior > 0 ? ((row.valorFinda - row.valorAnterior) / row.valorAnterior) * 100 : 0;
                    return (
                      <tr key={i} className={`hover:bg-blue-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="p-2.5 font-bold text-[#1B365D] border-r border-gray-200">{row.nomeCompleto}</td>
                        <td className="p-2.5 text-right font-mono text-gray-600 border-r border-gray-200">{row.valorAnterior > 0 ? formatKz(row.valorAnterior) : '—'}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-blue-900 border-r border-gray-200">{row.valorFinda > 0 ? formatKz(row.valorFinda) : '—'}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700 border-r border-gray-200">{row.aprovadoFinda > 0 ? formatKz(row.aprovadoFinda) : '—'}</td>
                        <td className="p-2.5 text-center font-mono font-bold">
                          {row.valorAnterior > 0 ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${varPct >= 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                              {varPct >= 0 ? `+${varPct.toFixed(1).replace('.', ',')}%` : `${varPct.toFixed(1).replace('.', ',')}%`}
                            </span>
                          ) : <span className="text-gray-400 text-[10px]">N/D</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
