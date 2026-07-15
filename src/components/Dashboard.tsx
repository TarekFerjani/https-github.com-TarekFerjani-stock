import React from 'react';
import PieChart from './PieChart';
import StatCard from './StatCard';
import { Location, Invoice, MovementType, Settings, Client, Room, Movement } from '../types';

interface DashboardProps {
  locations: Location[];
  clients: Client[];
  invoices: Invoice[];
  rooms: Room[];
  settings: Settings;
  movements: Movement[];
}

const Dashboard: React.FC<DashboardProps> = ({ locations, clients, invoices, rooms, settings, movements }) => {
  const stockDistributionData = React.useMemo(() => {
    const clientMap = new Map(clients.map(c => [c.id, `${c.nom} ${c.prenom}`]));
    const stockByClient = locations
      .filter(loc => loc.status === 'En cours')
      .reduce((acc, loc) => {
        const currentStock = acc.get(loc.clientId) || 0;
        acc.set(loc.clientId, currentStock + (Number(loc.nbCaisse) || 0));
        return acc;
      }, new Map<string, number>());

    const colors = ['#3b82f6', '#16a34a', '#ef4444', '#f97316', '#8b5cf6', '#eab308'];
    let colorIndex = 0;

    return Array.from(stockByClient.entries()).map(([clientId, count]) => ({
      label: clientMap.get(clientId) || 'Client inconnu',
      value: count,
      color: colors[colorIndex++ % colors.length],
    }));
  }, [locations, clients]);

  const roomStockData = React.useMemo(() => {
    const roomMap = new Map(rooms.map(r => [r.id, r.nom]));
    const stockByRoom = locations
      .filter(loc => loc.status === 'En cours')
      .reduce((acc, loc) => {
        const currentStock = acc.get(loc.roomId) || 0;
        acc.set(loc.roomId, currentStock + (Number(loc.nbCaisse) || 0));
        return acc;
      }, new Map<string, number>());

    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];
    let colorIndex = 0;

    return Array.from(stockByRoom.entries()).map(([roomId, count]) => ({
      label: roomMap.get(roomId) || 'Chambre inconnue',
      value: count,
      color: colors[colorIndex++ % colors.length],
    }));
  }, [locations, rooms]);
  
  const stats = React.useMemo(() => {
    const totalCratesInStock = locations.filter(l => l.status === 'En cours').reduce((sum, l) => sum + (Number(l.nbCaisse) || 0), 0);
    const activeClients = new Set(locations.filter(l => l.status === 'En cours').map(l => l.clientId)).size;
    const ongoingLoyer = locations
      .filter(loc => loc.status === 'En cours' && loc.entryDate)
      .reduce((sum, loc) => {
        const entryTime = new Date(loc.entryDate).getTime();
        if (isNaN(entryTime)) return sum;
        const days = Math.max(1, Math.ceil((new Date().getTime() - entryTime) / (1000 * 60 * 60 * 24)));
        const amount = (days || 0) * (Number(loc.nbCaisse) || 0) * (Number(settings.rentPerCratePerDay) || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    const pendingTotal = (invoices
      .filter(inv => (inv.type === MovementType.Sale || inv.type === MovementType.LocationOut) && inv.paymentStatus === 'En attente')
      .reduce((sum, inv) => sum + (Number((inv as any).montantTotal || (inv as any).loyer || 0) || 0), 0)) + ongoingLoyer;

    const totalCapacity = rooms.reduce((sum, r) => sum + r.nbCaisse, 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((totalCratesInStock / totalCapacity) * 100) : 0;

    const totalCratesOwned = movements.reduce((sum, m) => {
      if (m.type === MovementType.EmptyCratesOut) {
        return sum + (Number(m.nbCaisse) || 0);
      }
      if (
        m.type === MovementType.EmptyCratesReturn || 
        m.type === MovementType.LocationOut || 
        m.type === MovementType.Sale
      ) {
        return sum - (Number(m.nbCaisse) || 0);
      }
      return sum;
    }, 0);

    const emptyCratesOutside = totalCratesOwned - totalCratesInStock;

    return {
        totalCratesInStock,
        activeClients,
        pendingTotal,
        occupancyRate,
        emptyCratesOutside: Math.max(0, emptyCratesOutside)
    };
  }, [locations, invoices, rooms, settings, movements]);
  
  return (
    <div className="space-y-8 pb-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Tableau de bord</h2>
        <p className="text-gray-500 text-sm">Aperçu en temps réel de votre activité de stockage.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <StatCard title="Caisses en Stock" value={stats.totalCratesInStock.toString()} icon="box" />
          <StatCard title="Clients Actifs" value={stats.activeClients.toString()} icon="users" />
          <StatCard title="Caisses Vides Chez Clients" value={stats.emptyCratesOutside.toString()} icon="x-circle" />
          <StatCard title="Paiements en Attente" value={`${Math.round(stats.pendingTotal).toLocaleString('fr-FR')} ${settings.currencySymbol}`} icon="cash" />
          <StatCard title="Taux d'occupation" value={`${stats.occupancyRate}%`} icon="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
            <PieChart title="Répartition du Stock par Client" data={stockDistributionData} />
        </div>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
            <PieChart title="Répartition du Stock par Chambre" data={roomStockData} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
