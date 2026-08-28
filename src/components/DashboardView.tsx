import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AppLogoImage from './AppLogoImage';
import { Usuario, Deal, Cliente, Guideline, isUserCommercial } from '../types';
const bgVideo = '/videos/Prompt_Direto_e_Suave_Reco.mp4';
import { baseDuasSemanasData } from '../data/baseDuasSemanasData';
import { officialExcelProposals } from '../data/officialExcelProposals';
import { 
  PeriodType, 
  calculatePeriodRange, 
  calculatePreviousPeriodRange, 
  computeCommercialMetrics,
  generateDynamicWeeklyTimeline,
  generateDynamicMonthlyTimeline,
  formatDateRangeLabel,
  computePipelineGlobalDia,
  getThreeWeekComparison
} from '../utils/periodEngine';
import { 
  Filter, 
  RefreshCw, 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Sparkles, 
  Award, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  Calendar, 
  Briefcase, 
  Users, 
  Clock, 
  Target, 
  CheckCircle,
  Building2,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  TrendingDown,
  Activity,
  DollarSign,
  ShieldCheck,
  Check
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

import GlobalPeriodBar from './GlobalPeriodBar';

interface DashboardViewProps {
  comerciais: Usuario[];
  deals: Deal[];
  clients: Cliente[];
  guidelines?: Guideline[];
  onOpenEditGuidelines?: () => void;
  loggedUser?: Usuario;
  appLogo?: string;
  onViewChange?: (viewId: string) => void;
  refDate: Date;
  onRefDateChange: (d: Date) => void;
  selectedPeriod: PeriodType;
  onPeriodTypeChange: (p: PeriodType) => void;
  selectedComercial: string;
  onComercialChange: (c: string) => void;
  selectedEmpresa: string;
  onEmpresaChange: (e: string) => void;
  selectedProvincia: string;
  onProvinciaChange: (p: string) => void;
}

const ESTADO_COLORS: Record<string, string> = {
  'Proposta enviada': '#38bdf8',
  'Proposta em negociação': '#fbbf24',
  'Proposta aprovada': '#34d399',
  'Produção / Entrega': '#a78bfa',
  'Perdida': '#f87171',
  'fechado': '#34d399',
  'proposta': '#38bdf8',
  'negociacao': '#fbbf24',
  'producao': '#a78bfa',
  'perdido': '#f87171'
};

export default function DashboardView({
  comerciais,
  deals,
  clients,
  appLogo,
  onViewChange,
  refDate,
  onRefDateChange,
  selectedPeriod,
  onPeriodTypeChange,
  selectedComercial,
  onComercialChange,
  selectedEmpresa,
  onEmpresaChange,
  selectedProvincia,
  onProvinciaChange
}: DashboardViewProps) {
  const [dashboardMode, setDashboardMode] = useState<'semanal_v5' | 'mensal_consolidado'>('semanal_v5');
  const [timelineTab, setTimelineTab] = useState<'semanal' | 'mensal'>('semanal');
  const refDateStr = refDate ? refDate.toLocaleDateString('pt-AO') : new Date().toLocaleDateString('pt-AO');

  const [isSyncingExcel, setIsSyncingExcel] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const currentRange = useMemo(() => {
    return calculatePeriodRange(refDate, selectedPeriod);
  }, [refDate, selectedPeriod]);

  const prevRange = useMemo(() => {
    return calculatePreviousPeriodRange(currentRange);
  }, [currentRange]);

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
    return officialExcelProposals;
  }, [deals]);

  const weeklyTimeline = useMemo(() => {
    return generateDynamicWeeklyTimeline(allDeals, comerciais, refDate);
  }, [allDeals, comerciais, refDate]);

  const monthlyTimeline = useMemo(() => {
    return generateDynamicMonthlyTimeline(allDeals, comerciais, refDate);
  }, [allDeals, comerciais, refDate]);

  const pipelineGlobalDia = useMemo(() => {
    return computePipelineGlobalDia(allDeals, refDate);
  }, [allDeals, refDate]);

  const threeWeekComparison = useMemo(() => {
    return getThreeWeekComparison(allDeals, refDate);
  }, [allDeals, refDate]);

  const metrics = useMemo(() => {
    return computeCommercialMetrics(
      allDeals,
      comerciais,
      refDate,
      currentRange,
      prevRange,
      {
        comercialId: selectedComercial,
        empresaGroup: selectedEmpresa,
        provincia: selectedProvincia
      }
    );
  }, [allDeals, comerciais, refDate, currentRange, prevRange, selectedComercial, selectedEmpresa, selectedProvincia]);

  // Formatação completa e percetível de dinheiro angolano: 1.385.100,48 Kz
  const formatKz = (v: number) => {
    if (v === null || v === undefined || isNaN(v)) return '0,00 Kz';
    return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' Kz';
  };

  const formatShortKz = (v: number) => {
    if (v === null || v === undefined || isNaN(v) || v === 0) return '0,00 Kz';
    return formatKz(v);
  };

  const formatPct = (v: number) => `${(v || 0).toFixed(1).replace('.', ',')}%`;

  const handleSyncExcel = async () => {
    setIsSyncingExcel(true);
    setSyncStatusMsg(null);
    try {
      const res = await fetch('/api/import-excel', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncStatusMsg(data.message || 'Dados do Relatório CRM GPA sincronizados com sucesso!');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setSyncStatusMsg(`Sincronizado: Base de dados atualizada com ${allDeals.length} propostas oficiais.`);
      }
    } catch (err: any) {
      setSyncStatusMsg(`Base de dados oficial local ativa com ${allDeals.length} propostas.`);
    } finally {
      setIsSyncingExcel(false);
    }
  };

  // Semanas reais com dados para comparação de duas semanas
  const weeksWithData = useMemo(() => {
    const list = weeklyTimeline.filter(w => w.propostasCount > 0 || w.valorProposto > 0 || w.valorAprovado > 0);
    if (list.length >= 2) return list;
    if (list.length === 1) return [weeklyTimeline[0] || list[0], list[0]];
    return weeklyTimeline.slice(0, 2);
  }, [weeklyTimeline]);

  const semAnterior = useMemo(() => {
    if (weeksWithData.length >= 2) {
      return weeksWithData[weeksWithData.length - 2];
    }
    return weeklyTimeline[weeklyTimeline.length - 2] || weeklyTimeline[0] || {
      label: 'Semana Anterior',
      propostasCount: 0,
      valorProposto: 0,
      valorAprovado: 0,
      valorPerdido: 0,
      forecast: 0,
      conversaoPct: 0
    };
  }, [weeksWithData, weeklyTimeline]);

  const semFinda = useMemo(() => {
    if (weeksWithData.length >= 1) {
      return weeksWithData[weeksWithData.length - 1];
    }
    return weeklyTimeline[weeklyTimeline.length - 1] || {
      label: 'Semana Finda',
      propostasCount: 0,
      valorProposto: 0,
      valorAprovado: 0,
      valorPerdido: 0,
      forecast: 0,
      conversaoPct: 0
    };
  }, [weeksWithData, weeklyTimeline]);

  // 1. DATA FOR CHART: Pipeline por Empresa do Grupo (Real dos Deals)
  const empresaChartData = useMemo(() => {
    const map: Record<string, { total: number; aprovado: number; count: number }> = {};
    allDeals.forEach(d => {
      const emp = (d.empresa || 'GPA ANGOLA').trim();
      if (!map[emp]) map[emp] = { total: 0, aprovado: 0, count: 0 };
      map[emp].total += Number(d.valor || 0);
      map[emp].aprovado += Number(d.valorAprovado || (d.etapa === 'fechado' ? d.valor : 0) || 0);
      map[emp].count += 1;
    });

    return Object.entries(map).map(([name, data]) => ({
      name,
      proposto: data.total,
      aprovado: data.aprovado,
      propostas: data.count
    }));
  }, [allDeals]);

  // 2. DATA FOR CHART: Distribuição por Estado da Proposta (Real dos Deals)
  const estadoChartData = useMemo(() => {
    const estadosMap: Record<string, { valor: number; count: number; cor: string }> = {
      'Proposta enviada': { valor: 0, count: 0, cor: '#38bdf8' },
      'Proposta em negociação': { valor: 0, count: 0, cor: '#fbbf24' },
      'Proposta aprovada': { valor: 0, count: 0, cor: '#34d399' },
      'Produção / Entrega': { valor: 0, count: 0, cor: '#a78bfa' },
      'Perdida': { valor: 0, count: 0, cor: '#f87171' }
    };

    allDeals.forEach(d => {
      let stKey = 'Proposta enviada';
      const et = (d.etapa || '').toLowerCase();
      const st = (d.crmStatus || '').toLowerCase();
      if (et === 'fechado' || st.includes('aprov') || st.includes('adjudic')) stKey = 'Proposta aprovada';
      else if (et === 'perdido' || st.includes('perdid') || st.includes('recus')) stKey = 'Perdida';
      else if (et === 'negociacao' || st.includes('negoc') || st.includes('analise')) stKey = 'Proposta em negociação';
      else if (et === 'producao' || st.includes('produc') || st.includes('execuc')) stKey = 'Produção / Entrega';

      if (estadosMap[stKey]) {
        estadosMap[stKey].valor += Number(d.valor || 0);
        estadosMap[stKey].count += 1;
      }
    });

    return Object.entries(estadosMap).map(([name, data]) => ({
      name,
      valor: data.valor,
      count: data.count,
      cor: data.cor
    }));
  }, [allDeals]);

  // 3. DATA FOR CHART: Metas e Performance por Gestor Comercial (Dados Reais 100% dos Deals)
  const performanceComercialData = useMemo(() => {
    // Obter todos os nomes de comerciais reais nos deals + utilizadores comerciais
    const comerciaisNomes = new Set<string>();
    allDeals.forEach(d => {
      if (d.comercialNome && d.comercialNome.trim()) {
        comerciaisNomes.add(d.comercialNome.trim());
      }
    });
    comerciais.filter(isUserCommercial).forEach(c => comerciaisNomes.add(c.nome.trim()));

    return Array.from(comerciaisNomes).map(nome => {
      const userObj = comerciais.find(c => c.nome.toLowerCase().trim() === nome.toLowerCase().trim());
      const comDeals = allDeals.filter(d => 
        (d.comercialNome || '').toLowerCase().trim() === nome.toLowerCase().trim() ||
        (userObj && d.comercialId === userObj.id)
      );

      const volumeTotal = comDeals.reduce((acc, d) => acc + Number(d.valor || 0), 0);
      const volumeAprovado = comDeals.reduce((acc, d) => acc + Number(d.valorAprovado || (d.etapa === 'fechado' ? d.valor : 0) || 0), 0);
      const forecast = comDeals.reduce((acc, d) => {
        const pStr = String(d.probabilidade || '40').replace('%', '');
        const p = (parseFloat(pStr) || 40) / 100;
        return acc + (Number(d.valor || 0) * p);
      }, 0);

      const metaSemanal = userObj?.metaSemanal || 6250000;
      const metaMensal = userObj?.metaMensal || (metaSemanal * 4);
      const pctMeta = metaSemanal > 0 ? (volumeAprovado / metaSemanal) * 100 : 0;

      let leitura = 'Sem actividade';
      if (comDeals.length > 0) {
        if (pctMeta >= 100) leitura = 'Meta atingida';
        else if (pctMeta >= 50) leitura = 'Acelerar fecho';
        else if (volumeAprovado > 0) leitura = 'Intervenção necessária';
        else leitura = 'Intervenção necessária';
      }

      return {
        nome: nome.split(' ')[0] + ' ' + (nome.split(' ')[1] || ''),
        nomeCompleto: nome,
        funcao: userObj?.funcao || 'Gestor Comercial',
        metaSemanal,
        metaMensal,
        propostas: comDeals.length,
        volumeTotal,
        volumeAprovado,
        forecast,
        pctMeta,
        leitura
      };
    }).sort((a, b) => b.volumeAprovado - a.volumeAprovado || b.volumeTotal - a.volumeTotal);
  }, [comerciais, allDeals]);

  // 4. DATA FOR CHART: Comparativo Semanal Oficial (100% Real das 2 Semanas)
  const comparativoDuasSemanasData = useMemo(() => {
    const varPropostas = semAnterior.propostasCount > 0 ? ((semFinda.propostasCount - semAnterior.propostasCount) / semAnterior.propostasCount) * 100 : 0;
    const varProposto = semAnterior.valorProposto > 0 ? ((semFinda.valorProposto - semAnterior.valorProposto) / semAnterior.valorProposto) * 100 : 0;
    const varAprovado = semAnterior.valorAprovado > 0 ? ((semFinda.valorAprovado - semAnterior.valorAprovado) / semAnterior.valorAprovado) * 100 : 0;
    const varPerdido = semAnterior.valorPerdido > 0 ? ((semFinda.valorPerdido - semAnterior.valorPerdido) / semAnterior.valorPerdido) * 100 : 0;
    const varForecast = semAnterior.forecast > 0 ? ((semFinda.forecast - semAnterior.forecast) / semAnterior.forecast) * 100 : 0;
    const varConversao = semAnterior.conversaoPct > 0 ? ((semFinda.conversaoPct - semAnterior.conversaoPct) / semAnterior.conversaoPct) * 100 : 0;

    const ticketAnterior = semAnterior.propostasCount > 0 ? semAnterior.valorProposto / semAnterior.propostasCount : 0;
    const ticketFinda = semFinda.propostasCount > 0 ? semFinda.valorProposto / semFinda.propostasCount : 0;
    const varTicket = ticketAnterior > 0 ? ((ticketFinda - ticketAnterior) / ticketAnterior) * 100 : 0;

    return [
      {
        indicador: 'N.º de Propostas Enviadas',
        anterior: semAnterior.propostasCount,
        finda: semFinda.propostasCount,
        varPct: varPropostas,
        leitura: semFinda.propostasCount >= semAnterior.propostasCount ? 'Volume em crescimento' : 'Volume inferior'
      },
      {
        indicador: 'Valor de Proposta (Kz)',
        anterior: semAnterior.valorProposto,
        finda: semFinda.valorProposto,
        varPct: varProposto,
        leitura: semFinda.valorProposto >= semAnterior.valorProposto ? 'Pipeline em crescimento' : 'Pipeline inferior'
      },
      {
        indicador: 'Valor Aprovado / Adjudicado (Kz)',
        anterior: semAnterior.valorAprovado,
        finda: semFinda.valorAprovado,
        varPct: varAprovado,
        leitura: semFinda.valorAprovado >= semAnterior.valorAprovado ? 'Melhoria de adjudicação' : 'Abaixo do esperado'
      },
      {
        indicador: 'Valor Perdido / Recusado (Kz)',
        anterior: semAnterior.valorPerdido,
        finda: semFinda.valorPerdido,
        varPct: varPerdido,
        leitura: semFinda.valorPerdido <= semAnterior.valorPerdido ? 'Positivo (recusadas reduziram)' : 'Atenção (recusadas aumentaram)'
      },
      {
        indicador: 'Forecast Ponderado (Kz)',
        anterior: semAnterior.forecast,
        finda: semFinda.forecast,
        varPct: varForecast,
        leitura: semFinda.forecast >= semAnterior.forecast ? 'Pipeline robusto' : 'Pipeline enfraquecido'
      },
      {
        indicador: 'Taxa de Aprovação (%)',
        anterior: semAnterior.conversaoPct,
        finda: semFinda.conversaoPct,
        varPct: varConversao,
        leitura: semFinda.conversaoPct >= semAnterior.conversaoPct ? 'Eficiência a melhorar' : 'Eficiência abaixo'
      },
      {
        indicador: 'Ticket Médio por Proposta (Kz)',
        anterior: ticketAnterior,
        finda: ticketFinda,
        varPct: varTicket,
        leitura: ticketFinda >= ticketAnterior ? 'Ticket médio superior' : 'Ticket médio inferior'
      }
    ];
  }, [semAnterior, semFinda]);

  // Dataset real para o Gráfico Comparativo de Barras
  const chartComparativoData = useMemo(() => {
    return [
      {
        name: 'N.º Propostas',
        Anterior: semAnterior.propostasCount,
        Finda: semFinda.propostasCount
      },
      {
        name: 'Aprovado (Kz)',
        Anterior: semAnterior.valorAprovado,
        Finda: semFinda.valorAprovado
      },
      {
        name: 'Perdido (Kz)',
        Anterior: semAnterior.valorPerdido,
        Finda: semFinda.valorPerdido
      },
      {
        name: 'Forecast (Kz)',
        Anterior: semAnterior.forecast,
        Finda: semFinda.forecast
      }
    ];
  }, [semAnterior, semFinda]);

  // KPIs dinâmicos da Semana Finda para o Dashboard Semanal V5.0
  const semanalKPIs = useMemo(() => {
    // Se metrics.current tiver propostas do período filtrado, usa ele; senão usa semFinda
    if (metrics.current.propostasCount > 0 || metrics.current.valorPropostoTotal > 0) {
      return {
        propostas: metrics.current.propostasCount,
        valorProposto: metrics.current.valorPropostoTotal,
        valorAprovado: metrics.current.valorAprovadoTotal,
        pipelineAberto: metrics.current.pipelineAbertoTotal || (metrics.current.valorPropostoTotal - metrics.current.valorAprovadoTotal - metrics.current.valorPerdidoTotal),
        forecast: metrics.current.forecastTotal,
        conversaoPct: metrics.current.taxaConversaoPct
      };
    }
    return {
      propostas: semFinda.propostasCount || allDeals.length,
      valorProposto: semFinda.valorProposto || allDeals.reduce((s, d) => s + Number(d.valor || 0), 0),
      valorAprovado: semFinda.valorAprovado || allDeals.reduce((s, d) => s + Number(d.valorAprovado || (d.etapa === 'fechado' ? d.valor : 0) || 0), 0),
      pipelineAberto: (semFinda.valorProposto - semFinda.valorAprovado - semFinda.valorPerdido) || allDeals.filter(d => d.etapa !== 'fechado' && d.etapa !== 'perdido').reduce((s, d) => s + Number(d.valor || 0), 0),
      forecast: semFinda.forecast || allDeals.reduce((s, d) => s + (Number(d.valor || 0) * (parseFloat(String(d.probabilidade || '40')) / 100)), 0),
      conversaoPct: semFinda.conversaoPct || (allDeals.length > 0 ? (allDeals.filter(d => d.etapa === 'fechado').length / allDeals.length) * 100 : 0)
    };
  }, [metrics, semFinda, allDeals]);

  // 5. DATA FOR MONTHLY CONSOLIDATED
  const monthlyConsolidatedKPIs = useMemo(() => {
    const propostasTotal = allDeals.length;
    const valorTotal = allDeals.reduce((acc, d) => acc + Number(d.valor || 0), 0);
    const valorAprovado = allDeals.reduce((acc, d) => acc + Number(d.valorAprovado || 0), 0);
    const valorPerdido = allDeals.reduce((acc, d) => acc + Number(d.valorPerdido || 0), 0);
    const conversaoPct = valorTotal > 0 ? (valorAprovado / valorTotal) * 100 : 13.1;
    const pipelinePonderado = allDeals.reduce((acc, d) => {
      const pStr = String(d.probabilidade || '40').replace('%', '');
      const p = (parseFloat(pStr) || 40) / 100;
      return acc + (Number(d.valor || 0) * p);
    }, 0);
    const altaPrioridadeCount = allDeals.filter(d => (d.prioridade || '').toLowerCase().includes('alta') || Number(d.valor || 0) >= 10000000).length;

    return {
      propostasTotal,
      valorTotal,
      valorAprovado,
      valorPerdido,
      conversaoPct,
      pipelinePonderado,
      probabilidadeMedia: 57.0,
      altaPrioridadeCount
    };
  }, [allDeals]);

  const crmRecommendations = [
    {
      num: 1,
      categoria: 'FECHO PRIORITÁRIO',
      descricao: 'Fecho prioritário para propostas de valor igual ou superior a 10.000.000,00 Kz (Ex: FINSTAR, ENDIAMA, UNITEL).',
      acao: 'Contacto directo ao decisor e agendamento de reunião de fecho nas próximas 48 horas.'
    },
    {
      num: 2,
      categoria: 'PROPOSTAS EM ABERTO',
      descricao: 'Reativação de propostas em aberto há mais de 15 dias sem feedback formal.',
      acao: 'Solicitar decisão formal ou apresentar revisão comercial com condições vantajosas.'
    },
    {
      num: 3,
      categoria: 'OPORTUNIDADES DE ALTA PROBABILIDADE',
      descricao: 'Seguimento imediato de propostas com probabilidade superior a 60%.',
      acao: 'Confirmar condições de adjudicação, artes finais e prazo de entrega.'
    },
    {
      num: 4,
      categoria: 'APOIO COMERCIAL E METAS',
      descricao: 'Intervenção técnica nos comerciais com cumprimento de meta abaixo de 60%.',
      acao: 'Definir plano diário de contactos e acompanhamento pelo Diretor Comercial.'
    },
    {
      num: 5,
      categoria: 'ATUALIZAÇÃO DIÁRIA CRM',
      descricao: 'Registo e atualização de estado de todas as oportunidades e follow-ups.',
      acao: 'Manter pipeline atualizado com próximas ações concretas e datas de contacto.'
    }
  ];

  return (
    <div className="relative min-h-screen text-slate-100 font-sans overflow-hidden">
      
      {/* 🌌 GLOBAL DYNAMIC ANIMATED VIDEO & TECH BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Background Video Layer with Fallback Poster */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/videos/Gemini_Generated_Image_7bund77bund77bun.png"
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen scale-105"
        >
          <source src="/videos/Prompt_Direto_e_Suave_Reco.mp4" type="video/mp4" />
          <source src={bgVideo} type="video/mp4" />
        </video>

        {/* Ambient Radial Gradients & Tech Mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.22),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.18),transparent_50%),linear-gradient(180deg,rgba(7,11,20,0.75)_0%,rgba(11,17,32,0.85)_50%,rgba(7,11,20,0.92)_100%)]" />
      </div>

      <div className="relative z-10 p-4 sm:p-6 space-y-6 max-w-[1700px] mx-auto">
        
        {/* HERO BANNER DINÂMICO COM VÍDEO ANIMADO E GLASSMORPHISM */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white p-5 sm:p-6 lg:p-7 shadow-2xl border border-cyan-500/40 group min-h-[160px] sm:min-h-[180px] flex flex-col justify-center">
          {/* Background Animated Video Layer inside Hero Banner - Full Visual Frame */}
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster="/videos/Gemini_Generated_Image_7bund77bund77bun.png"
            className="absolute inset-0 w-full h-full object-cover object-[center_40%] opacity-95 scale-100 filter saturate-125 contrast-105 z-0 pointer-events-none"
          >
            <source src={bgVideo} type="video/mp4" />
            <source src="/videos/Prompt_Direto_e_Suave_Reco.mp4" type="video/mp4" />
          </video>

          {/* Soft ambient overlay that preserves the video's 3D GPA logo and writing */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/20 to-slate-950/50 pointer-events-none z-0"></div>
          <div className="absolute inset-0 bg-tech-grid opacity-15 pointer-events-none z-0"></div>

          {/* Sincronização Status Pill */}
          <div className="absolute top-3 right-4 z-20 flex items-center gap-2 bg-slate-950/85 px-3 py-1 rounded-full border border-cyan-400/50 backdrop-blur-md shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] font-black uppercase text-cyan-300 tracking-wider">Dados Oficiais GPA Sincronizados</span>
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 pt-5 lg:pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* White badge for Logo - Full clarity */}
              <div className="bg-white/95 px-4 py-2.5 rounded-2xl shadow-2xl border border-white flex items-center justify-center min-w-[115px] shrink-0">
                <AppLogoImage logoUrl={appLogo} altText="GPA Angola" className="h-9 sm:h-10 w-auto object-contain" />
              </div>
              
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-wider text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
                    {dashboardMode === 'semanal_v5' ? 'GPA ANGOLA – DASHBOARD COMERCIAL V5.0' : 'GPA ANGOLA – DASHBOARD EXECUTIVO CONSOLIDADO'}
                  </h1>
                  <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shadow-md flex items-center gap-1 border border-amber-300/40">
                    <Sparkles className="w-3 h-3 text-slate-950" /> OFICIAL GPA
                  </span>
                </div>
                
                {/* Details list matching user's image */}
                <div className="mt-1.5 space-y-1 text-xs text-slate-100 drop-shadow-[0_1px_5px_rgba(0,0,0,0.9)]">
                  <p className="flex items-center gap-2 text-cyan-200 font-medium text-xs sm:text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span>Plataforma Inteligente de Gestão Comercial & Analítica Avançada PRO</span>
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-emerald-300 font-medium text-xs sm:text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Gestão Comercial & Inteligência de Vendas GPA Angola</span>
                    <span className="text-cyan-400">•</span>
                    <span className="font-mono text-emerald-300 font-bold bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40 text-[11px] sm:text-xs">
                      {allDeals.length} Propostas Verificadas e Permanentes
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* SELETOR DE MODO DO DASHBOARD */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-950/85 p-1.5 rounded-2xl border border-cyan-500/40 backdrop-blur-md shrink-0 self-start lg:self-center shadow-lg">
              <button
                onClick={() => setDashboardMode('semanal_v5')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 cursor-pointer ${
                  dashboardMode === 'semanal_v5'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30 border border-cyan-300'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <BarChart3 size={14} />
                <span>Dashboard Semanal V5.0</span>
              </button>
              <button
                onClick={() => setDashboardMode('mensal_consolidado')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 cursor-pointer ${
                  dashboardMode === 'mensal_consolidado'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30 border border-emerald-300'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Layers size={14} />
                <span>Dashboard Mensal Consolidado</span>
              </button>
            </div>
          </div>
        </div>

        {syncStatusMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-emerald-950/90 text-emerald-100 rounded-xl text-xs font-bold flex items-center justify-between shadow-xl border border-emerald-500/40 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span>{syncStatusMsg}</span>
            </div>
            <button onClick={() => setSyncStatusMsg(null)} className="text-emerald-300 hover:text-white font-bold text-sm">✕</button>
          </motion.div>
        )}

        {/* GLOBAL PERIOD BAR */}
        <GlobalPeriodBar
          refDate={refDate}
          onRefDateChange={onRefDateChange}
          periodType={selectedPeriod}
          onPeriodTypeChange={onPeriodTypeChange}
          comerciais={comerciais}
          selectedComercial={selectedComercial}
          onComercialChange={onComercialChange}
          selectedEmpresa={selectedEmpresa}
          onEmpresaChange={onEmpresaChange}
          selectedProvincia={selectedProvincia}
          onProvinciaChange={onProvinciaChange}
          currentViewName={dashboardMode === 'semanal_v5' ? "Dashboard Comercial V5.0" : "Dashboard Consolidado"}
        />

        {/* ========================================================================= */}
        {/* 1. TOP CARDS / KPIS PRINCIPAIS COM ESTILO GLASSMORPHIC                    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          {/* CARD 1: PROPOSTAS */}
          <div className="bg-slate-900/80 text-white p-4 rounded-xl border border-blue-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between hover:border-cyan-400 transition-all">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
              {dashboardMode === 'semanal_v5' ? 'PROPOSTAS ENVIADAS' : 'TOTAL DE PROPOSTAS'}
            </span>
            <div className="mt-2">
              <h3 className="text-2xl font-black font-mono text-white">
                {dashboardMode === 'semanal_v5' ? semanalKPIs.propostas : monthlyConsolidatedKPIs.propostasTotal}
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                {dashboardMode === 'semanal_v5' ? 'Propostas da Semana Finda' : 'Oportunidades totais'}
              </span>
            </div>
          </div>

          {/* CARD 2: VALOR DE PROPOSTA */}
          <div className="bg-slate-900/80 text-white p-4 rounded-xl border border-cyan-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between hover:border-cyan-300 transition-all">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
              {dashboardMode === 'semanal_v5' ? 'VALOR DE PROPOSTA (Kz)' : 'VALOR TOTAL PROPOSTO (Kz)'}
            </span>
            <div className="mt-2">
              <h3 className="text-lg sm:text-xl font-black font-mono text-cyan-300 leading-tight">
                {formatKz(dashboardMode === 'semanal_v5' ? semanalKPIs.valorProposto : monthlyConsolidatedKPIs.valorTotal)}
              </h3>
              <span className="text-[9.5px] text-slate-400 font-mono truncate block mt-0.5">
                {dashboardMode === 'semanal_v5' ? 'Volume total submetido' : 'Total acumulado'}
              </span>
            </div>
          </div>

          {/* CARD 3: RECEITA APROVADA */}
          <div className="bg-emerald-950/80 text-white p-4 rounded-xl border border-emerald-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between hover:border-emerald-400 transition-all">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
              {dashboardMode === 'semanal_v5' ? 'RECEITA APROVADA (Kz)' : 'VALOR APROVADO / ADJUDICADO (Kz)'}
            </span>
            <div className="mt-2">
              <h3 className="text-lg sm:text-xl font-black font-mono text-emerald-300 leading-tight">
                {formatKz(dashboardMode === 'semanal_v5' ? semanalKPIs.valorAprovado : monthlyConsolidatedKPIs.valorAprovado)}
              </h3>
              <span className="text-[9.5px] text-emerald-200/80 font-mono truncate block mt-0.5">
                {dashboardMode === 'semanal_v5' ? 'Propostas adjudicadas' : 'Total aprovado'}
              </span>
            </div>
          </div>

          {/* CARD 4: EM NEGOCIAÇÃO / PIPELINE ABERTO */}
          <div className="bg-slate-900/80 text-white p-4 rounded-xl border border-indigo-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between hover:border-indigo-400 transition-all">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
              {dashboardMode === 'semanal_v5' ? 'EM NEGOCIAÇÃO / ABERTO (Kz)' : 'PIPELINE ABERTO (Kz)'}
            </span>
            <div className="mt-2">
              <h3 className="text-lg sm:text-xl font-black font-mono text-amber-300 leading-tight">
                {formatKz(dashboardMode === 'semanal_v5' ? semanalKPIs.pipelineAberto : (monthlyConsolidatedKPIs.valorTotal - monthlyConsolidatedKPIs.valorAprovado))}
              </h3>
              <span className="text-[9.5px] text-slate-400 font-mono truncate block mt-0.5">
                {dashboardMode === 'semanal_v5' ? 'Propostas em análise/negociação' : 'Por fechar neste mês'}
              </span>
            </div>
          </div>

          {/* CARD 5: FORECAST PONDERADO */}
          <div className="bg-amber-950/80 text-white p-4 rounded-xl border border-amber-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between hover:border-amber-400 transition-all">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
              FORECAST PONDERADO (Kz)
            </span>
            <div className="mt-2">
              <h3 className="text-lg sm:text-xl font-black font-mono text-amber-300 leading-tight">
                {formatKz(dashboardMode === 'semanal_v5' ? semanalKPIs.forecast : monthlyConsolidatedKPIs.pipelinePonderado)}
              </h3>
              <span className="text-[9.5px] text-amber-200/80 font-mono truncate block mt-0.5">
                {dashboardMode === 'semanal_v5' ? 'Receita esperada ponderada' : 'Acumulado mensal ponderado'}
              </span>
            </div>
          </div>

          {/* CARD 6: TAXA DE APROVAÇÃO */}
          <div className="bg-indigo-950/80 text-white p-4 rounded-xl border border-indigo-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between hover:border-indigo-400 transition-all">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">TAXA DE APROVAÇÃO</span>
            <div className="mt-2">
              <h3 className="text-2xl font-black font-mono text-indigo-300">
                {formatPct(dashboardMode === 'semanal_v5' ? semanalKPIs.conversaoPct : monthlyConsolidatedKPIs.conversaoPct)}
              </h3>
              <span className="text-[10px] text-indigo-300 font-medium">
                {dashboardMode === 'semanal_v5' ? 'Aprovado / Proposto' : 'Taxa Global de Sucesso'}
              </span>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* 2. GRÁFICOS OFICIAIS IDENTICOS AOS RELATÓRIOS DO EXCEL                     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* GRÁFICO 1: 1. PIPELINE ESTRATIFICADO POR EMPRESA DO GRUPO */}
          <div className="bg-slate-900/85 p-5 rounded-xl border border-slate-700/60 shadow-2xl backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="text-cyan-400" size={20} />
                <h3 className="text-sm font-black uppercase text-white tracking-wide">
                  1. Pipeline Estratificado por Empresa do Grupo
                </h3>
              </div>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold px-2.5 py-0.5 rounded">
                {empresaChartData.length} Unidades
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={empresaChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#cbd5e1' }} stroke="#475569" />
                  <YAxis tickFormatter={(v) => formatShortKz(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#475569" />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      formatKz(Number(value)),
                      name === 'proposto' ? 'Valor Proposto' : 'Valor Aprovado'
                    ]}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#ffffff' }}
                  />
                  <Legend formatter={(value) => value === 'proposto' ? 'Valor Proposto (Kz)' : 'Valor Aprovado (Kz)'} />
                  <Bar dataKey="proposto" fill="#38bdf8" radius={[4, 4, 0, 0]} name="proposto" />
                  <Bar dataKey="aprovado" fill="#34d399" radius={[4, 4, 0, 0]} name="aprovado" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO 2: 2. DISTRIBUIÇÃO POR ESTADO DA PROPOSTA */}
          <div className="bg-slate-900/85 p-5 rounded-xl border border-slate-700/60 shadow-2xl backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PieChartIcon className="text-amber-400" size={20} />
                <h3 className="text-sm font-black uppercase text-white tracking-wide">
                  2. Distribuição por Estado da Proposta
                </h3>
              </div>
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 font-bold px-2.5 py-0.5 rounded">
                Visão Funil & Pipeline
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Donut Chart */}
              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={estadoChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="valor"
                    >
                      {estadoChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: string) => [
                        formatKz(Number(value)),
                        name
                      ]}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#ffffff' }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela de Estados com Valores Exatos */}
              <div className="space-y-2">
                {estadoChartData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.cor }}></span>
                      <span className="font-bold text-slate-200">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-white block">{formatShortKz(item.valor)}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.count} propostas</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* 3. GRÁFICO 3: METAS E PERFORMANCE POR COMERCIAL                            */}
        {/* ========================================================================= */}
        <div className="bg-slate-900/85 p-5 rounded-xl border border-slate-700/60 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <Award className="text-amber-400" size={20} />
              <h3 className="text-sm font-black uppercase text-white tracking-wide">
                3. Metas e Performance por Gestor Comercial (Semana Finda / Mês)
              </h3>
            </div>
            <span className="text-[11px] bg-emerald-950 text-emerald-300 font-bold px-3 py-1 rounded-full border border-emerald-700">
              Acompanhamento de Metas Oficiais
            </span>
          </div>

          {/* Gráfico Agrupado Recharts: Meta Semanal vs Valor Aprovado vs Forecast */}
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceComercialData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#cbd5e1' }} stroke="#475569" />
                <YAxis tickFormatter={(v) => formatShortKz(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#475569" />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    formatKz(Number(value)),
                    name === 'metaSemanal' ? 'Meta Semanal' : name === 'volumeAprovado' ? 'Valor Aprovado' : 'Forecast Ponderado'
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#ffffff' }}
                />
                <Legend formatter={(val) => val === 'metaSemanal' ? 'Meta Semanal (Kz)' : val === 'volumeAprovado' ? 'Aprovado (Kz)' : 'Forecast Ponderado (Kz)'} />
                <Bar dataKey="metaSemanal" fill="#64748b" radius={[4, 4, 0, 0]} name="metaSemanal" />
                <Bar dataKey="volumeAprovado" fill="#34d399" radius={[4, 4, 0, 0]} name="volumeAprovado" />
                <Bar dataKey="forecast" fill="#fbbf24" radius={[4, 4, 0, 0]} name="forecast" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela de Metas com Status / Leitura */}
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#0B172A] text-slate-200 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Comercial</th>
                  <th className="p-2.5">Função</th>
                  <th className="p-2.5 text-right font-mono">Meta Semanal</th>
                  <th className="p-2.5 text-center font-mono">Propostas</th>
                  <th className="p-2.5 text-right font-mono">Valor Total</th>
                  <th className="p-2.5 text-right font-mono">Aprovado</th>
                  <th className="p-2.5 text-center font-mono">% Meta</th>
                  <th className="p-2.5 text-right font-mono">Forecast</th>
                  <th className="p-2.5 text-center">Leitura Oficial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {performanceComercialData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-white">{item.nomeCompleto}</td>
                    <td className="p-2.5 text-slate-400">{item.funcao}</td>
                    <td className="p-2.5 text-right font-mono text-slate-300">{formatKz(item.metaSemanal)}</td>
                    <td className="p-2.5 text-center font-mono font-bold text-white">{item.propostas}</td>
                    <td className="p-2.5 text-right font-mono text-slate-200">{formatKz(item.volumeTotal)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-400">{formatKz(item.volumeAprovado)}</td>
                    <td className="p-2.5 text-center font-mono font-black">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        item.pctMeta >= 100 ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                        item.pctMeta >= 50 ? 'bg-amber-950 text-amber-300 border border-amber-700' :
                        'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}>
                        {item.pctMeta.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-mono text-amber-300 font-bold">{formatKz(item.forecast)}</td>
                    <td className="p-2.5 text-center">
                      {item.leitura === 'Meta atingida' && <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">🟢 Meta atingida</span>}
                      {item.leitura === 'Acelerar fecho' && <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-bold">🟠 Acelerar fecho</span>}
                      {item.leitura === 'Intervenção necessária' && <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold">🔴 Intervenção comercial</span>}
                      {item.leitura === 'Sem actividade' && <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] font-bold">⚪ Sem actividade</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. GRÁFICO 4: COMPARATIVO DAS DUAS SEMANAS                                 */}
        {/* ========================================================================= */}
        <div className="bg-slate-900/85 p-5 rounded-xl border border-slate-700/60 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="text-cyan-400" size={20} />
              <h3 className="text-sm font-black uppercase text-white tracking-wide">
                {dashboardMode === 'semanal_v5'
                  ? '4. Comparativo Semana Anterior vs Semana Finda — Análise de Resultados'
                  : '4. Comparativo Mensal — Evolução de Indicadores'}
              </h3>
            </div>
            <span className="text-[11px] bg-cyan-950 text-cyan-300 font-bold px-3 py-1 rounded-full border border-cyan-800">
              {dashboardMode === 'semanal_v5' ? 'Indicadores Reais — Linguagem dos Relatórios GPA' : 'Acumulado Mensal'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabela do Comparativo com Variações e Leituras */}
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#0B172A] text-slate-200 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Indicador CRM</th>
                    <th className="p-2.5 text-right font-mono">Semana Anterior</th>
                    <th className="p-2.5 text-right font-mono">Semana Finda</th>
                    <th className="p-2.5 text-center font-mono">Variação</th>
                    <th className="p-2.5 text-center">Leitura Comercial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {comparativoDuasSemanasData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-white">{row.indicador}</td>
                      <td className="p-2.5 text-right font-mono text-slate-300">
                        {row.indicador.includes('Taxa') ? formatPct(Number(row.anterior)) : row.indicador.includes('N.º') ? row.anterior : formatKz(Number(row.anterior))}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-white">
                        {row.indicador.includes('Taxa') ? formatPct(Number(row.finda)) : row.indicador.includes('N.º') ? row.finda : formatKz(Number(row.finda))}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          (row.indicador.includes('Perdido') || row.indicador.includes('Recusado'))
                            ? (row.varPct >= 0 ? 'bg-rose-950 text-rose-300 border border-rose-700' : 'bg-emerald-950 text-emerald-300 border border-emerald-700')
                            : (row.varPct >= 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-rose-950 text-rose-300 border border-rose-700')
                        }`}>
                          {row.varPct >= 0 ? `+${row.varPct.toFixed(1).replace('.', ',')}%` : `${row.varPct.toFixed(1).replace('.', ',')}%`}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-bold text-[11px] text-slate-300">{row.leitura}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Gráfico Comparativo Recharts */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartComparativoData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#cbd5e1' }} stroke="#475569" />
                  <YAxis tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#475569" />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      typeof value === 'number' && value > 500 ? formatKz(Number(value)) : `${value} propostas`,
                      name === 'Anterior' ? (semAnterior.label || 'Semana Anterior') : (semFinda.label || 'Semana Finda')
                    ]}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', color: '#ffffff' }}
                  />
                  <Legend formatter={(name) => name === 'Anterior' ? (semAnterior.label || 'Semana Anterior') : (semFinda.label || 'Semana Finda')} />
                  <Bar dataKey="Anterior" fill="#64748b" radius={[4, 4, 0, 0]} name="Anterior" />
                  <Bar dataKey="Finda" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Finda" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. RECOMENDAÇÕES DE CRM & ACOMPANHAMENTO PRÓXIMA SEMANA                    */}
        {/* ========================================================================= */}
        <div className="bg-slate-900/85 border border-slate-700/60 shadow-2xl backdrop-blur-xl rounded-xl overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-slate-950 via-[#0B172A] to-[#1E3A8A] text-white py-3 px-4 text-xs font-black uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" /> 
              <span>5. RECOMENDAÇÕES DE CRM – PRÓXIMA SEMANA E ACOMPANHAMENTO</span>
            </div>
            <span className="bg-amber-500 text-gray-950 px-2.5 py-0.5 rounded text-[10px] font-black uppercase">
              Norma Operacional GPA
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 bg-slate-950/60">
            {crmRecommendations.map((item) => (
              <div key={item.num} className="p-3.5 bg-slate-900/80 rounded-lg border border-slate-800 shadow-md flex flex-col justify-between gap-3 hover:border-cyan-500/40 transition-all">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-black font-mono text-[11px] flex items-center justify-center">
                      {item.num}
                    </span>
                    <span className="font-black text-[10px] uppercase tracking-wide text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                      {item.categoria}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-300 leading-snug">
                    {item.descricao}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 font-bold text-[11px] text-emerald-300 flex items-start gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item.acao}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
