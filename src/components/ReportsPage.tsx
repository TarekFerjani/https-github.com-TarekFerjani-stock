import React, { useMemo, useState } from 'react';
import { Movement, MovementType, Settings, Room, Location, Invoice, Client, Reglement, Contract } from '../types';
import LineChart from './LineChart';
import BarChart from './BarChart';
import PieChart from './PieChart';
import StatCard from './StatCard';
import { calculateMonthlyRent } from '../utils/paymentUtils';

interface ReportsPageProps {
  movements: Movement[];
  settings: Settings;
  rooms: Room[];
  locations: Location[];
  invoices: Invoice[];
  clients: Client[];
  reglements: Reglement[];
  contracts: Contract[];
}

interface ClientMetrics {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  emptyCrates: number;
  pendingAmount: number;
  riskScore: number;
  color: string;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ movements, settings, rooms, locations, invoices, clients, reglements, contracts }) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showCurve, setShowCurve] = useState(true);

  const clientMetricsList = useMemo<ClientMetrics[]>(() => {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
      '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', 
      '#f97316', '#6366f1'
    ];

    const list = clients.map((client, index) => {
      // 1. Calculate empty crates: EmptyCratesOut - EmptyCratesReturn - cratesCurrentlyInLocation
      const clientCratesInStock = locations
        .filter(l => l.clientId === client.id && l.status === 'En cours')
        .reduce((sum, l) => sum + (Number(l.nbCaisse) || 0), 0);

      const emptyCratesOutSum = movements
        .filter(m => m.clientId === client.id && m.type === MovementType.EmptyCratesOut)
        .reduce((sum, m) => sum + (Number(m.nbCaisse) || 0), 0);

      const emptyCratesReturnSum = movements
        .filter(m => m.clientId === client.id && (m.type === MovementType.EmptyCratesReturn || m.type === MovementType.LocationOut || m.type === MovementType.Sale))
        .reduce((sum, m) => sum + (Number(m.nbCaisse) || 0), 0);

      const emptyCrates = emptyCratesOutSum - emptyCratesReturnSum - clientCratesInStock;

      // 2. Calculate pending invoices amount (remaining balance)
      const pendingInvoices = movements
        .filter(m => m.clientId === client.id && (m.type === MovementType.Sale || m.type === MovementType.LocationOut || m.type === MovementType.EmptyCratesOut) && (m as any).paymentStatus === 'En attente')
        .reduce((sum, m) => {
          const hasTotal = (m as any).montantTotal !== undefined && (m as any).montantTotal !== null;
          const totalAmount = hasTotal ? Number((m as any).montantTotal) : Number((m as any).loyer || (m as any).caution || 0);
          const paidAmount = reglements
            .filter(r => r.invoiceId === m.id)
            .reduce((total, r) => total + r.amount, 0);
          const remaining = Math.max(0, totalAmount - paidAmount);
          return sum + remaining;
        }, 0);

      // 3. Calculate ongoing rent accumulated
      const ongoingLoyer = locations
        .filter(loc => loc.clientId === client.id && loc.status === 'En cours' && loc.entryDate)
        .reduce((sum, loc) => {
          const entryTime = new Date(loc.entryDate).getTime();
          if (isNaN(entryTime)) return sum;
          const amount = calculateMonthlyRent(
            loc.entryDate,
            Number(loc.nbCaisse) || 0,
            Number(settings.rentPerCratePerDay) || 0,
            Number(settings.rentIncreaseRate) || 0,
            Number(settings.increaseStartMonth) || 0
          );
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);

      const pendingAmount = pendingInvoices + ongoingLoyer;

      return {
        id: client.id,
        name: `${client.nom} ${client.prenom}`,
        phone: client.telephone,
        email: client.email,
        emptyCrates: Math.max(0, emptyCrates),
        pendingAmount: Math.round(pendingAmount),
        riskScore: 0, // calculated below
        color: colors[index % colors.length]
      };
    }).filter(item => item.emptyCrates > 0 || item.pendingAmount > 0);

    // Calculate relative Risk Scores for prioritizing attention
    const maxCr = Math.max(...list.map(c => c.emptyCrates), 1);
    const maxPend = Math.max(...list.map(c => c.pendingAmount), 1);

    return list.map(item => ({
      ...item,
      riskScore: Math.round(((item.emptyCrates / maxCr) * 50) + ((item.pendingAmount / maxPend) * 50))
    })).sort((a, b) => b.riskScore - a.riskScore);
  }, [clients, movements, invoices, locations, settings, reglements, contracts]);

  const reportsData = useMemo(() => {
    try {
      const salesMonthlyMap: Map<string, { label: string, total: number }> = new Map();
      const locationsMonthlyMap: Map<string, { label: string, total: number }> = new Map();

      // Ensure we have months sorted properly
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = d.toISOString().substring(0, 7);
        const label = d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
        salesMonthlyMap.set(key, { label, total: 0 });
        locationsMonthlyMap.set(key, { label, total: 0 });
      }

      movements.forEach(m => {
        const dateObj = new Date(m.date);
        if (isNaN(dateObj.getTime())) return;

        const monthKey = dateObj.toISOString().substring(0, 7); // YYYY-MM
        const monthLabel = dateObj.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
        
        if (m.type === MovementType.Sale) {
          const montant = Number((m as any).montantTotal) || 0;
          const cur = salesMonthlyMap.get(monthKey) || { label: monthLabel, total: 0 };
          cur.total += montant;
          salesMonthlyMap.set(monthKey, cur);
        }
        if (m.type === MovementType.LocationOut) {
          const loyer = Number((m as any).loyer) || 0;
          const cur = locationsMonthlyMap.get(monthKey) || { label: monthLabel, total: 0 };
          cur.total += loyer;
          locationsMonthlyMap.set(monthKey, cur);
        }
      });

      const sortedSalesMonths = Array.from(salesMonthlyMap.entries()).sort(([a], [b]) => a.localeCompare(b));
      const sortedLocationsMonths = Array.from(locationsMonthlyMap.entries()).sort(([a], [b]) => a.localeCompare(b));

      const salesRevenueData = {
        labels: sortedSalesMonths.map(([, info]) => info.label),
        datasets: [{
          label: `CA Ventes (${settings.currencySymbol})`,
          data: sortedSalesMonths.map(([, info]) => info.total),
          color: '#3b82f6'
        }]
      };

      const locationsRevenueData = {
        labels: sortedLocationsMonths.map(([, info]) => info.label),
        datasets: [{
          label: `CA Locations (${settings.currencySymbol})`,
          data: sortedLocationsMonths.map(([, info]) => info.total),
          color: '#16a34a'
        }]
      };

      const reportStats = {
        totalSalesRevenue: Array.from(salesMonthlyMap.values()).reduce((sum, v) => sum + v.total, 0),
        totalLocationsRevenue: Array.from(locationsMonthlyMap.values()).reduce((sum, v) => sum + v.total, 0),
        totalCratesInStock: locations.filter(l => l.status === 'En cours').reduce((sum, l) => sum + (Number(l.nbCaisse) || 0), 0),
        activeContracts: contracts.filter(c => c.status === 'Actif').length
      };

      return { 
        salesRevenueData,
        locationsRevenueData,
        reportStats
      };
    } catch (err) {
      console.error("Erreur calcul rapports:", err);
      return null;
    }
  }, [movements, locations, settings.currencySymbol, contracts]);

  const paymentStatusData = useMemo(() => {
    const statusTotals = movements
      .filter(m => m.type === MovementType.LocationOut)
      .reduce((acc, m) => {
        const hasTotal = (m as any).montantTotal !== undefined && (m as any).montantTotal !== null;
        const totalAmount = hasTotal ? Number((m as any).montantTotal) : Number((m as any).loyer || (m as any).caution || 0);
        const paidAmount = reglements
          .filter(r => r.invoiceId === m.id)
          .reduce((total, r) => total + r.amount, 0);
        const remaining = Math.max(0, totalAmount - paidAmount);

        acc['Payé'] = (acc['Payé'] || 0) + paidAmount;
        acc['En attente'] = (acc['En attente'] || 0) + remaining;
        return acc;
      }, {} as Record<'Payé' | 'En attente', number>);

    // Add ongoing rentals
    const ongoingLoyer = locations
      .filter(loc => loc.status === 'En cours' && loc.entryDate)
      .reduce((sum, loc) => {
        const entryTime = new Date(loc.entryDate).getTime();
        if (isNaN(entryTime)) return sum;
        const amount = calculateMonthlyRent(
          loc.entryDate,
          Number(loc.nbCaisse) || 0,
          Number(settings.rentPerCratePerDay) || 0,
          Number(settings.rentIncreaseRate) || 0,
          Number(settings.increaseStartMonth) || 0
        );
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    statusTotals['En attente'] = (statusTotals['En attente'] || 0) + ongoingLoyer;

    return [
      { label: 'Payé', value: statusTotals['Payé'] || 0, color: '#16a34a' },
      { label: 'En attente (dont en cours)', value: statusTotals['En attente'] || 0, color: '#f97316' },
    ].filter(item => item.value > 0);
  }, [movements, locations, settings, reglements]);

  const selectedClientDetails = useMemo(() => {
    if (!selectedClientId) return null;
    return clientMetricsList.find(c => c.id === selectedClientId) || null;
  }, [selectedClientId, clientMetricsList]);

  // Calculate limits & values for the multi-axis curve
  const maxCrates = useMemo(() => {
    if (clientMetricsList.length === 0) return 10;
    return Math.max(...clientMetricsList.map(c => c.emptyCrates), 10);
  }, [clientMetricsList]);

  const maxPayments = useMemo(() => {
    if (clientMetricsList.length === 0) return 500;
    return Math.max(...clientMetricsList.map(c => c.pendingAmount), 500);
  }, [clientMetricsList]);

  // Memoize coordinates for drawing dual comparison curves
  const curvePoints = useMemo(() => {
    if (clientMetricsList.length === 0) return [];
    
    const paddingLeft = 60;
    const paddingRight = 60;
    const paddingTop = 40;
    const paddingBottom = 60;

    const chartWidth = 600 - paddingLeft - paddingRight;
    const chartHeight = 400 - paddingTop - paddingBottom;
    const N = clientMetricsList.length;

    const sortedList = [...clientMetricsList].sort((a, b) => a.name.localeCompare(b.name));

    return sortedList.map((client, i) => {
      const cx = paddingLeft + (N > 1 ? (i / (N - 1)) * chartWidth : chartWidth / 2);
      const cyCrates = paddingTop + chartHeight - (client.emptyCrates / maxCrates) * chartHeight;
      const cyPayments = paddingTop + chartHeight - (client.pendingAmount / maxPayments) * chartHeight;
      return { cx, cyCrates, cyPayments, client };
    });
  }, [clientMetricsList, maxCrates, maxPayments]);

  const cratesCurvePath = useMemo(() => {
    if (curvePoints.length === 0) return "";
    if (curvePoints.length === 1) return `M ${curvePoints[0].cx} ${curvePoints[0].cyCrates}`;
    
    let d = `M ${curvePoints[0].cx} ${curvePoints[0].cyCrates}`;
    for (let i = 0; i < curvePoints.length - 1; i++) {
      const curr = curvePoints[i];
      const next = curvePoints[i + 1];
      const controlX = (curr.cx + next.cx) / 2;
      d += ` C ${controlX} ${curr.cyCrates}, ${controlX} ${next.cyCrates}, ${next.cx} ${next.cyCrates}`;
    }
    return d;
  }, [curvePoints]);

  const paymentsCurvePath = useMemo(() => {
    if (curvePoints.length === 0) return "";
    if (curvePoints.length === 1) return `M ${curvePoints[0].cx} ${curvePoints[0].cyPayments}`;
    
    let d = `M ${curvePoints[0].cx} ${curvePoints[0].cyPayments}`;
    for (let i = 0; i < curvePoints.length - 1; i++) {
      const curr = curvePoints[i];
      const next = curvePoints[i + 1];
      const controlX = (curr.cx + next.cx) / 2;
      d += ` C ${controlX} ${curr.cyPayments}, ${controlX} ${next.cyPayments}, ${next.cx} ${next.cyPayments}`;
    }
    return d;
  }, [curvePoints]);

  const cratesAreaPath = useMemo(() => {
    if (curvePoints.length === 0) return "";
    const yBaseline = 400 - 60;
    return `${cratesCurvePath} L ${curvePoints[curvePoints.length - 1].cx} ${yBaseline} L ${curvePoints[0].cx} ${yBaseline} Z`;
  }, [curvePoints, cratesCurvePath]);

  const paymentsAreaPath = useMemo(() => {
    if (curvePoints.length === 0) return "";
    const yBaseline = 400 - 60;
    return `${paymentsCurvePath} L ${curvePoints[curvePoints.length - 1].cx} ${yBaseline} L ${curvePoints[0].cx} ${yBaseline} Z`;
  }, [curvePoints, paymentsCurvePath]);

  const paymentsByClientData = useMemo(() => {
    const clientMap = new Map<string, number>();

    // Finalized invoices (ONLY Pending)
    invoices
      .filter(inv => inv.paymentStatus === 'En attente')
      .forEach(inv => {
        const hasTotal = (inv as any).montantTotal !== undefined && (inv as any).montantTotal !== null;
        const totalAmount = hasTotal ? Number((inv as any).montantTotal) : Number((inv as any).loyer || (inv as any).caution || 0);
        const paidAmount = reglements
          .filter(r => r.invoiceId === inv.id)
          .reduce((total, r) => total + r.amount, 0);
        const remaining = Math.max(0, totalAmount - paidAmount);
        clientMap.set(inv.clientId, (clientMap.get(inv.clientId) || 0) + remaining);
      });

    // Ongoing rentals (Accumulated rent)
    locations
      .filter(loc => loc.status === 'En cours' && loc.entryDate)
      .forEach(loc => {
        const entryTime = new Date(loc.entryDate).getTime();
        if (!isNaN(entryTime)) {
          const amount = calculateMonthlyRent(
            loc.entryDate,
            Number(loc.nbCaisse) || 0,
            Number(settings.rentPerCratePerDay) || 0,
            Number(settings.rentIncreaseRate) || 0,
            Number(settings.increaseStartMonth) || 0
          );
          clientMap.set(loc.clientId, (clientMap.get(loc.clientId) || 0) + (isNaN(amount) ? 0 : amount));
        }
      });

    const categories = Array.from(clientMap.entries())
      .map(([clientId, total]) => {
        const client = clients.find(c => c.id === clientId);
        return {
          label: client ? `${client.nom} ${client.prenom}` : 'Inconnu',
          value: Math.round(total)
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 clients for readability

    return {
      labels: categories.map(c => c.label),
      datasets: [{
        label: `Reste à payer (${settings.currencySymbol})`,
        data: categories.map(c => c.value),
        color: '#f97316'
      }]
    };
  }, [invoices, locations, clients, settings, reglements]);

  if (!reportsData) {
    return <div className="p-10 text-center text-red-500 font-bold">Erreur lors de la génération des rapports. Veuillez vérifier vos données.</div>;
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Rapports d'Activité</h1>
        <p className="text-sm text-gray-500 font-medium">Analyse approfondie de vos performances commerciales et de l'état de vos règlements.</p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total CA Ventes" value={`${Math.round(reportsData.reportStats.totalSalesRevenue).toLocaleString('fr-FR')} ${settings.currencySymbol}`} icon="cash" />
        <StatCard title="Total CA Locations" value={`${Math.round(reportsData.reportStats.totalLocationsRevenue).toLocaleString('fr-FR')} ${settings.currencySymbol}`} icon="cash" />
        <StatCard title="Caisses en stock" value={reportsData.reportStats.totalCratesInStock.toString()} icon="box" />
        <StatCard title="Contrats actifs" value={reportsData.reportStats.activeContracts.toString()} icon="users" />
      </div>

      {/* HIGHLY CREATIVE INTERACTIVE COMPARATIVE CURVE */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Courbe Comparative : Caisses Vides &amp; Paiements Clients</h3>
            <p className="text-xs text-gray-500 mt-1">Analysez l'équilibre entre les caisses détenues par les clients (axe gauche) et leur encours financier restant dû (axe droit).</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCurve(!showCurve)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center space-x-1.5 ${
                showCurve 
                  ? 'bg-primary-50 border-primary-200 text-primary-700 shadow-xs' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
              <span>{showCurve ? "Masquer la Courbe" : "Afficher la Courbe"}</span>
            </button>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-1.5 bg-amber-500 rounded-sm"></span>
                <span className="text-gray-600">Caisses Vides (Axe gauche)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-1.5 bg-blue-500 rounded-sm"></span>
                <span className="text-gray-600">Paiements Dus (Axe droit)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Interactive SVG Curve View */}
          <div className="lg:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-100 relative">
            {curvePoints.length > 0 ? (
              <div className="w-full relative h-[400px]">
                {/* Visual grid background */}
                <svg className="w-full h-full overflow-visible" viewBox="0 0 600 400" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="crates-curve-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="payments-curve-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines and Y scales */}
                  {Array.from({ length: 5 + 1 }).map((_, i) => {
                    const y = 40 + 300 - (i / 5) * 300;
                    const valueCrates = (i / 5) * maxCrates;
                    const valuePayments = (i / 5) * maxPayments;
                    return (
                      <g key={`grid-y-${i}`}>
                        {/* Left Y scale */}
                        <text x="50" y={y} textAnchor="end" alignmentBaseline="middle" fontSize="9" className="fill-amber-600 font-bold">
                          {Math.round(valueCrates)}
                        </text>
                        {/* Grid Line */}
                        <line x1="60" y1={y} x2="540" y2={y} stroke="#e2e8f0" strokeDasharray="2 2" strokeWidth="1" />
                        {/* Right Y scale */}
                        <text x="550" y={y} textAnchor="start" alignmentBaseline="middle" fontSize="9" className="fill-blue-600 font-bold">
                          {Math.round(valuePayments)} {settings.currencySymbol}
                        </text>
                      </g>
                    );
                  })}

                  {/* X-Axis Ticks & Labels */}
                  {curvePoints.map((pt) => {
                    const nameLabel = pt.client.name.split(' ').map(n => n[0]).join('');
                    return (
                      <g key={`xtick-${pt.client.id}`}>
                        <line x1={pt.cx} y1="340" x2={pt.cx} y2="345" stroke="#cbd5e1" strokeWidth="1.5" />
                        <text 
                          x={pt.cx} 
                          y="360" 
                          textAnchor="middle" 
                          fontSize="9" 
                          className="fill-gray-500 font-bold"
                        >
                          {nameLabel}
                        </text>
                      </g>
                    );
                  })}

                  {/* Curve fills */}
                  {showCurve && (
                    <>
                      {cratesAreaPath && (
                        <path 
                          d={cratesAreaPath} 
                          fill="url(#crates-curve-grad)" 
                          className="transition-all duration-500 ease-in-out pointer-events-none" 
                        />
                      )}
                      {paymentsAreaPath && (
                        <path 
                          d={paymentsAreaPath} 
                          fill="url(#payments-curve-grad)" 
                          className="transition-all duration-500 ease-in-out pointer-events-none" 
                        />
                      )}
                    </>
                  )}

                  {/* Curve lines */}
                  {showCurve && (
                    <>
                      {cratesCurvePath && (
                        <path 
                          d={cratesCurvePath} 
                          fill="none" 
                          stroke="#f59e0b" 
                          strokeWidth="3" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                          className="transition-all duration-500 ease-in-out pointer-events-none opacity-90" 
                        />
                      )}
                      {paymentsCurvePath && (
                        <path 
                          d={paymentsCurvePath} 
                          fill="none" 
                          stroke="#3b82f6" 
                          strokeWidth="3" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                          className="transition-all duration-500 ease-in-out pointer-events-none opacity-90" 
                        />
                      )}
                    </>
                  )}

                  {/* Interactive client nodes / points on curve */}
                  {curvePoints.map((pt) => {
                    const isSelected = selectedClientId === pt.client.id;
                    const isAnySelected = selectedClientId !== null;

                    return (
                      <g 
                        key={`interactive-${pt.client.id}`}
                        className="cursor-pointer transition-all duration-300"
                        onMouseEnter={() => setSelectedClientId(pt.client.id)}
                        onMouseLeave={() => setSelectedClientId(null)}
                        onClick={() => setSelectedClientId(isSelected ? null : pt.client.id)}
                        style={{ opacity: !isAnySelected || isSelected ? 1 : 0.4 }}
                      >
                        {/* Hover vertical tracking line */}
                        {isSelected && (
                          <line x1={pt.cx} y1="40" x2={pt.cx} y2="340" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
                        )}

                        {/* Ripple animation for high-risk clients */}
                        {pt.client.riskScore > 50 && (
                          <circle 
                            cx={pt.cx} 
                            cy={pt.cyPayments} 
                            r={isSelected ? 20 : 12} 
                            className="animate-ping fill-none" 
                            stroke="#ef4444" 
                            strokeWidth="1.5" 
                            style={{ animationDuration: '3s' }}
                          />
                        )}

                        {/* Crates Point Circle */}
                        <circle 
                          cx={pt.cx} 
                          cy={pt.cyCrates} 
                          r={isSelected ? 8 : 5} 
                          fill="#ffffff" 
                          stroke="#f59e0b"
                          strokeWidth={isSelected ? 3 : 2}
                          className="shadow-sm transition-all duration-300"
                        />

                        {/* Payments Point Circle */}
                        <circle 
                          cx={pt.cx} 
                          cy={pt.cyPayments} 
                          r={isSelected ? 8 : 5} 
                          fill="#ffffff" 
                          stroke="#3b82f6"
                          strokeWidth={isSelected ? 3 : 2}
                          className="shadow-sm transition-all duration-300"
                        />

                        {/* Hidden hover hit box for easier interaction */}
                        <rect
                          x={pt.cx - 20}
                          y="40"
                          width="40"
                          height="300"
                          fill="transparent"
                          className="cursor-pointer"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[350px] text-gray-400">Aucun client actif à afficher sur la courbe.</div>
            )}
          </div>

          {/* Sidebar Interactive Context Details & Checklist */}
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 h-full flex flex-col justify-between">
              {selectedClientDetails ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                      style={{ backgroundColor: selectedClientDetails.color }}
                    >
                      {selectedClientDetails.name.split(' ').map(n => n[0]).join('')}
                    </span>
                    <div>
                      <h4 className="font-bold text-gray-900 leading-tight">{selectedClientDetails.name}</h4>
                      <p className="text-[11px] text-gray-500 font-medium">{selectedClientDetails.phone || 'Aucun numéro de téléphone'}</p>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block mb-1">Caisses vides détenues</span>
                      <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs">
                        <span className="text-sm font-bold text-slate-800">{selectedClientDetails.emptyCrates} caisses</span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">En circulation</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block mb-1">Encours financiers restant dus</span>
                      <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs">
                        <span className="text-sm font-bold text-slate-800">{selectedClientDetails.pendingAmount.toLocaleString('fr-FR')} {settings.currencySymbol}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-red-50 text-red-700 rounded-full">À recouvrer</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block mb-1">Niveau d'attention requis</span>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            selectedClientDetails.riskScore > 70 
                              ? 'bg-red-500' 
                              : selectedClientDetails.riskScore > 40 
                              ? 'bg-amber-500' 
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${selectedClientDetails.riskScore}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 font-medium mt-1">
                        <span>Sain</span>
                        <span className="font-semibold text-gray-700">{selectedClientDetails.riskScore}% Prioritaire</span>
                        <span>Alerte</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-gray-600 leading-relaxed">
                    <strong className="text-slate-800 block mb-1">Recommandation :</strong>
                    {selectedClientDetails.riskScore > 70 
                      ? "⚠️ Client prioritaire. Organiser une récupération urgente des caisses vides et envoyer un rappel des loyers de location en cours."
                      : selectedClientDetails.emptyCrates > selectedClientDetails.pendingAmount / 100 
                      ? "📦 Ce client dispose d'un stock de caisses vides important. Relancer pour un retour d'entrepot ou une nouvelle facturation."
                      : "💬 Solde financier à surveiller. S'assurer que les factures arrivées à échéance sont régularisées."
                    }
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400 my-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <p className="text-xs font-semibold text-slate-600">Survolez un client sur le graphique</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">Pour afficher ses informations de stock et relancer.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Classic Reports Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
          <PieChart title="État des Paiements des Loyers" data={paymentStatusData} currencySymbol={settings.currencySymbol} />
        </div>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
          <BarChart title={`Paiements en attente par client (${settings.currencySymbol})`} data={paymentsByClientData} />
        </div>
      </div>

      {/* Line charts comparing Sales & Rental Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <LineChart title={`Courbes de ventes (${settings.currencySymbol})`} data={reportsData.salesRevenueData} />
        <LineChart title={`Courbes de locations (${settings.currencySymbol})`} data={reportsData.locationsRevenueData} />
      </div>
    </div>
  );
};

export default ReportsPage;
