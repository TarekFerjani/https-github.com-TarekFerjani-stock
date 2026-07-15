import React, { useMemo, useState } from 'react';
import { Movement, MovementType, Settings, Room, Location, Invoice, Client } from '../types';
import LineChart from './LineChart';
import BarChart from './BarChart';
import PieChart from './PieChart';
import StatCard from './StatCard';

interface ReportsPageProps {
  movements: Movement[];
  settings: Settings;
  rooms: Room[];
  locations: Location[];
  invoices: Invoice[];
  clients: Client[];
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

const ReportsPage: React.FC<ReportsPageProps> = ({ movements, settings, rooms, locations, invoices, clients }) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const clientMetricsList = useMemo<ClientMetrics[]>(() => {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
      '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', 
      '#f97316', '#6366f1'
    ];

    const list = clients.map((client, index) => {
      // 1. Calculate empty crates
      const emptyCrates = movements
        .filter(m => m.clientId === client.id)
        .reduce((balance, m) => {
          if (m.type === MovementType.EmptyCratesOut) return balance + (Number(m.nbCaisse) || 0);
          if (
            m.type === MovementType.EmptyCratesReturn || 
            m.type === MovementType.LocationOut || 
            m.type === MovementType.Sale
          ) {
            return balance - (Number(m.nbCaisse) || 0);
          }
          return balance;
        }, 0);

      // 2. Calculate pending invoices amount
      const pendingInvoices = invoices
        .filter(inv => inv.clientId === client.id && inv.paymentStatus === 'En attente')
        .reduce((sum, inv) => sum + (Number((inv as any).loyer || (inv as any).montantTotal) || 0), 0);

      // 3. Calculate ongoing rent accumulated
      const ongoingLoyer = locations
        .filter(loc => loc.clientId === client.id && loc.status === 'En cours' && loc.entryDate)
        .reduce((sum, loc) => {
          const entryTime = new Date(loc.entryDate).getTime();
          if (isNaN(entryTime)) return sum;
          const days = Math.max(1, Math.ceil((new Date().getTime() - entryTime) / (1000 * 60 * 60 * 24)));
          const amount = (days || 0) * (Number(loc.nbCaisse) || 0) * (Number(settings.rentPerCratePerDay) || 0);
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
  }, [clients, movements, invoices, locations, settings]);

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
        activeLocations: locations.filter(l => l.status === 'En cours').length
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
  }, [movements, locations, settings.currencySymbol]);

  const paymentStatusData = useMemo(() => {
    const statusTotals = invoices
      .filter(inv => inv.type === MovementType.LocationOut)
      .reduce((acc, inv) => {
        const status = inv.paymentStatus || 'En attente';
        const amount = Number((inv as any).loyer || (inv as any).montantTotal) || 0;
        acc[status] = (acc[status] || 0) + amount;
        return acc;
      }, {} as Record<'Payé' | 'En attente', number>);

    // Add ongoing rentals
    const ongoingLoyer = locations
      .filter(loc => loc.status === 'En cours' && loc.entryDate)
      .reduce((sum, loc) => {
        const entryTime = new Date(loc.entryDate).getTime();
        if (isNaN(entryTime)) return sum;
        const days = Math.max(1, Math.ceil((new Date().getTime() - entryTime) / (1000 * 60 * 60 * 24)));
        const amount = (days || 0) * (Number(loc.nbCaisse) || 0) * (Number(settings.rentPerCratePerDay) || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    statusTotals['En attente'] = (statusTotals['En attente'] || 0) + ongoingLoyer;

    return [
      { label: 'Payé', value: statusTotals['Payé'] || 0, color: '#16a34a' },
      { label: 'En attente (dont en cours)', value: statusTotals['En attente'] || 0, color: '#f97316' },
    ].filter(item => item.value > 0);
  }, [invoices, locations, settings]);

  const selectedClientDetails = useMemo(() => {
    if (!selectedClientId) return null;
    return clientMetricsList.find(c => c.id === selectedClientId) || null;
  }, [selectedClientId, clientMetricsList]);

  // Calculate limits & values for the Matrix SVG Map
  const matrixConfig = useMemo(() => {
    if (clientMetricsList.length === 0) return null;
    const maxCr = Math.max(...clientMetricsList.map(c => c.emptyCrates), 10);
    const maxPend = Math.max(...clientMetricsList.map(c => c.pendingAmount), 500);
    return { maxCr, maxPend };
  }, [clientMetricsList]);

  const paymentsByClientData = useMemo(() => {
    const clientMap = new Map<string, number>();

    // Finalized invoices (ONLY Pending)
    invoices
      .filter(inv => inv.paymentStatus === 'En attente')
      .forEach(inv => {
        const amount = Number((inv as any).loyer || (inv as any).montantTotal) || 0;
        clientMap.set(inv.clientId, (clientMap.get(inv.clientId) || 0) + amount);
      });

    // Ongoing rentals (Accumulated rent)
    locations
      .filter(loc => loc.status === 'En cours' && loc.entryDate)
      .forEach(loc => {
        const entryTime = new Date(loc.entryDate).getTime();
        if (!isNaN(entryTime)) {
          const days = Math.max(1, Math.ceil((new Date().getTime() - entryTime) / (1000 * 60 * 60 * 24)));
          const amount = (days || 0) * (Number(loc.nbCaisse) || 0) * (Number(settings.rentPerCratePerDay) || 0);
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
  }, [invoices, locations, clients, settings]);

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
        <StatCard title="Contrats actifs" value={reportsData.reportStats.activeLocations.toString()} icon="users" />
      </div>

      {/* HIGHLY CREATIVE INTERACTIVE QUADRANT risk MATRIX */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Matrice Interactive : Caisses Vides &amp; Paiements Clients</h3>
            <p className="text-xs text-gray-500 mt-1">Surveillez l'équilibre entre les caisses détenues par les clients et leur solde financier dû.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
            <span className="text-xs text-gray-600 font-medium mr-2">Risque Élevé</span>
            <span className="inline-block w-3 h-3 bg-amber-500 rounded-full"></span>
            <span className="text-xs text-gray-600 font-medium mr-2">Caisses dehors</span>
            <span className="inline-block w-3 h-3 bg-blue-500 rounded-full"></span>
            <span className="text-xs text-gray-600 font-medium">Stable / En attente</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Interactive SVG Matrix View */}
          <div className="lg:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-100 relative">
            {matrixConfig && clientMetricsList.length > 0 ? (
              <div className="w-full relative h-[400px]">
                {/* Visual grid background */}
                <svg className="w-full h-full overflow-visible" viewBox="0 0 600 400" preserveAspectRatio="none">
                  {/* Quadrant Lines */}
                  <line x1="300" y1="20" x2="300" y2="340" stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth="1.5" />
                  <line x1="60" y1="180" x2="570" y2="180" stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth="1.5" />

                  {/* Quadrant Text Labels */}
                  <text x="70" y="35" className="fill-blue-500 text-[10px] font-bold tracking-wider opacity-80 uppercase">💰 Paiements Attente (Peu de caisses)</text>
                  <text x="560" y="35" textAnchor="end" className="fill-red-500 text-[10px] font-bold tracking-wider opacity-90 uppercase">⚠️ Risque Élevé (Beaucoup de caisses &amp; Dettes)</text>
                  <text x="70" y="330" className="fill-emerald-600 text-[10px] font-bold tracking-wider opacity-80 uppercase">✅ Profil Stable (Faibles encours)</text>
                  <text x="560" y="330" textAnchor="end" className="fill-amber-600 text-[10px] font-bold tracking-wider opacity-80 uppercase">📦 Caisses Dehors (Peu de dettes)</text>

                  {/* Axis Titles */}
                  <text x="300" y="380" textAnchor="middle" className="fill-gray-600 text-xs font-semibold">Nombre de Caisses Vides chez le Client →</text>
                  <text x="20" y="180" textAnchor="middle" transform="rotate(-90,20,180)" className="fill-gray-600 text-xs font-semibold">Solde Restant Dû ({settings.currencySymbol}) →</text>

                  {/* Axis scale values */}
                  <text x="60" y="360" textAnchor="middle" className="fill-gray-400 text-[10px]">0</text>
                  <text x="300" y="360" textAnchor="middle" className="fill-gray-400 text-[10px]">{Math.round(matrixConfig.maxCr / 2)} caisses</text>
                  <text x="570" y="360" textAnchor="middle" className="fill-gray-400 text-[10px]">{matrixConfig.maxCr} caisses</text>

                  <text x="50" y="340" textAnchor="end" className="fill-gray-400 text-[10px]">0</text>
                  <text x="50" y="180" textAnchor="end" className="fill-gray-400 text-[10px]">{Math.round(matrixConfig.maxPend / 2)} {settings.currencySymbol}</text>
                  <text x="50" y="25" textAnchor="end" className="fill-gray-400 text-[10px]">{matrixConfig.maxPend} {settings.currencySymbol}</text>

                  {/* Client Data Points */}
                  {clientMetricsList.map((client) => {
                    // Coordinates calculation
                    const paddingLeft = 60;
                    const paddingRight = 30;
                    const paddingTop = 20;
                    const paddingBottom = 60;

                    const plotWidth = 600 - paddingLeft - paddingRight;
                    const plotHeight = 400 - paddingTop - paddingBottom;

                    // Map emptyCrates onto X (paddingLeft to 600 - paddingRight)
                    const cx = paddingLeft + (client.emptyCrates / matrixConfig.maxCr) * plotWidth;
                    // Map pendingAmount onto Y (paddingTop to 400 - paddingBottom) -> SVG Y goes down, so we invert
                    const cy = paddingTop + plotHeight - (client.pendingAmount / matrixConfig.maxPend) * plotHeight;

                    const isSelected = selectedClientId === client.id;
                    const isAnySelected = selectedClientId !== null;

                    return (
                      <g 
                        key={client.id}
                        className="cursor-pointer transition-all duration-300"
                        onMouseEnter={() => setSelectedClientId(client.id)}
                        onMouseLeave={() => setSelectedClientId(null)}
                        onClick={() => setSelectedClientId(isSelected ? null : client.id)}
                        style={{ opacity: !isAnySelected || isSelected ? 1 : 0.35 }}
                      >
                        {/* Interactive Ripple rings for higher risk */}
                        {client.riskScore > 50 && (
                          <circle 
                            cx={cx} 
                            cy={cy} 
                            r={isSelected ? 26 : 16} 
                            className="animate-ping fill-none" 
                            stroke={client.riskScore > 75 ? '#ef4444' : '#f59e0b'} 
                            strokeWidth="1" 
                            style={{ animationDuration: '3s' }}
                          />
                        )}
                        {/* Main Circle */}
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={isSelected ? 16 : 10} 
                          fill={client.color} 
                          className="shadow-md transition-all duration-300 hover:scale-125 hover:stroke-white hover:stroke-2"
                        />
                        {/* Text Label next to circle */}
                        <text 
                          x={cx + (isSelected ? 20 : 14)} 
                          y={cy + 4} 
                          className="text-[10px] font-bold fill-gray-800 select-none bg-white px-1 pointer-events-none"
                        >
                          {client.name.split(' ').map(n => n[0]).join('')}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[350px] text-gray-400">Aucun client actif à afficher dans la matrice.</div>
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
