
import React, { useState, useEffect, useMemo } from 'react';
import { Movement, MovementType, Client, Product, Settings, MovementSale, Room, MovementLocationIn, Location, MovementEmptyCratesOut, MovementLocationOut, Reglement } from '../types';
import { movementService } from '../services/movementService';
import { authService } from '../services/authService';
import { calculateMonthlyRent } from '../utils/paymentUtils';

interface AddMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  products: Product[];
  clients: Client[];
  rooms: Room[];
  movements: Movement[];
  locations: Location[];
  movementToEdit: Movement | null;
  settings: Settings;
  reglements: Reglement[];
}

const AddMovementModal: React.FC<AddMovementModalProps> = ({ isOpen, onClose, onSave, products, clients, rooms, movements, locations, movementToEdit, settings, reglements }) => {
  const [movementData, setMovementData] = useState<Partial<Movement>>({});

  const resetForm = (type: MovementType) => {
    const common = { type, clientId: '' };
    switch (type) {
      case MovementType.Sale: setMovementData({ ...common, productId: '', roomId: '', nbCaisse: 1, poidsBrut: 0, prixUnitaire: 0 }); break;
      case MovementType.LocationIn: setMovementData({ ...common, productId: '', nbCaisse: 1, roomId: '' }); break;
      case MovementType.LocationOut: setMovementData({ ...common, productId: '', roomId: '', nbCaisse: 1, prixUnitaire: 0, cautionAppliquee: false, montantTotal: 0, paymentStatus: 'En attente' }); break;
      case MovementType.EmptyCratesReturn: setMovementData({ ...common, nbCaisse: 1 }); break;
      case MovementType.EmptyCratesOut: setMovementData({ ...common, nbCaisse: 1 }); break;
      default: setMovementData({ type: MovementType.Sale, clientId: '' });
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (movementToEdit) {
        setMovementData({
           ...movementToEdit,
           nbCaisse: (movementToEdit as any).nbCaisse || (movementToEdit as any).nbCaisseRetournees || 0
        });
      } else {
        resetForm(MovementType.LocationIn);
      }
    }
  }, [movementToEdit, isOpen]);

  useEffect(() => {
    let newMovementData: Partial<Movement> | null = null;
    const currentDataString = JSON.stringify(movementData);
    const { type } = movementData;

    if (type === MovementType.Sale) {
      const saleData = movementData as Partial<MovementSale>;
      const { nbCaisse = 0, poidsBrut = 0, prixUnitaire = 0, clientId, productId, roomId } = saleData;

      const emptyCrateWeight = Number(settings.emptyCrateWeight) || 0;
      const taxRate = Number(settings.taxRate) || 0;
      const rentPerCratePerDay = Number(settings.rentPerCratePerDay || 0);

      // Poids Net
      const poidsNet = Number((poidsBrut - (nbCaisse * emptyCrateWeight)).toFixed(2));
      const finalPoidsNet = poidsNet > 0 ? poidsNet : 0;

      // Montant HT
      const montantHT = Number((finalPoidsNet * prixUnitaire).toFixed(2));
      
      // Taxe (TVA)
      const taxe = Number((montantHT * (taxRate / 100)).toFixed(2));
      
      // Total Facturé (TTC)
      const finalMontantTotal = Number((montantHT + taxe).toFixed(2));

      // Calculate estimated storage loyer for the items being sold (FIFO)
      let estimatedLoyer = 0;
      if (clientId && productId && roomId && nbCaisse > 0) {
        const clientLocs = locations
          .filter(l => l.clientId === clientId && l.status === 'En cours' && l.productId === productId && l.roomId === roomId)
          .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
        
        let remaining = nbCaisse;
        for (const loc of clientLocs) {
          if (remaining <= 0) break;
          const withdraw = Math.min(remaining, loc.nbCaisse);
          estimatedLoyer += calculateMonthlyRent(
            loc.entryDate,
            withdraw,
            rentPerCratePerDay,
            Number(settings.rentIncreaseRate) || 0,
            Number(settings.increaseStartMonth) || 0
          );
          remaining -= withdraw;
        }
        if (remaining > 0) {
          estimatedLoyer += calculateMonthlyRent(
            1, // 1 day counts as 1 month
            remaining,
            rentPerCratePerDay,
            Number(settings.rentIncreaseRate) || 0,
            Number(settings.increaseStartMonth) || 0
          );
        }
      } else {
        estimatedLoyer = calculateMonthlyRent(
          1, // 1 day counts as 1 month
          nbCaisse,
          rentPerCratePerDay,
          Number(settings.rentIncreaseRate) || 0,
          Number(settings.increaseStartMonth) || 0
        );
      }

      newMovementData = { 
        ...saleData, 
        poidsNet: finalPoidsNet, 
        montantTotal: finalMontantTotal > 0 ? finalMontantTotal : 0, 
        taxe: taxe > 0 ? taxe : 0,
        loyer: Number(estimatedLoyer.toFixed(0))
      };

    } else if (type === MovementType.EmptyCratesOut) {
      const crateData = movementData as Partial<MovementEmptyCratesOut>;
      const { nbCaisse = 0 } = crateData;
      const cautionPerCrate = Number(settings.cautionPerCrate) || 0;
      const caution = Number((nbCaisse * cautionPerCrate).toFixed(0));
      newMovementData = { ...crateData, caution, montantTotal: caution };

    } else if (type === MovementType.LocationOut) {
      const withdrawalData = movementData as any;
      const qte = Number(withdrawalData.nbCaisse || 0);
      const rentPerCratePerDay = Number(settings.rentPerCratePerDay || 0);
      const cautionPerCrate = Number(settings.cautionPerCrate) || 0;
      
      // Calculate real FIFO loyer
      const clientLocs = locations
        .filter(l => l.clientId === withdrawalData.clientId && l.status === 'En cours' && l.productId === withdrawalData.productId && l.roomId === withdrawalData.roomId)
        .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
      
      let remaining = qte;
      let calculatedLoyer = 0;
      
      for (const loc of clientLocs) {
        if (remaining <= 0) break;
        const withdraw = Math.min(remaining, loc.nbCaisse);
        calculatedLoyer += calculateMonthlyRent(
          loc.entryDate,
          withdraw,
          rentPerCratePerDay,
          Number(settings.rentIncreaseRate) || 0,
          Number(settings.increaseStartMonth) || 0
        );
        remaining -= withdraw;
      }
      
      if (remaining > 0) {
        calculatedLoyer += calculateMonthlyRent(
          1, // 1 day counts as 1 month
          remaining,
          rentPerCratePerDay,
          Number(settings.rentIncreaseRate) || 0,
          Number(settings.increaseStartMonth) || 0
        );
      }
      
      const loyer = Number(calculatedLoyer.toFixed(0));
      const caution = Number((qte * cautionPerCrate).toFixed(0));
      
      // Calculate montantTotal based on whether caution is applied
      const baseTotal = withdrawalData.cautionAppliquee ? Math.max(0, loyer - caution) : loyer;
      
      newMovementData = { 
        ...withdrawalData, 
        loyer, 
        caution,
        montantTotal: baseTotal 
      };
    }

    if (newMovementData && JSON.stringify(newMovementData) !== currentDataString) {
      setMovementData(newMovementData);
    }
  }, [movementData, locations, settings]);

  // Automatically select the active product and room for the selected client if there are active locations
  useEffect(() => {
    const { type, clientId } = movementData;
    if (type === MovementType.LocationOut && clientId) {
      const clientActiveLocations = locations.filter(
        l => l.clientId === clientId && l.status === 'En cours'
      );
      if (clientActiveLocations.length > 0) {
        const firstLoc = clientActiveLocations[0];
        setMovementData(prev => {
          const hasValidSelection = clientActiveLocations.some(
            l => l.productId === prev.productId && l.roomId === prev.roomId
          );
          if (!hasValidSelection) {
            return {
              ...prev,
              productId: firstLoc.productId,
              roomId: firstLoc.roomId
            };
          }
          return prev;
        });
      } else {
        setMovementData(prev => {
          if (prev.productId || prev.roomId) {
            return { ...prev, productId: '', roomId: '' };
          }
          return prev;
        });
      }
    }
  }, [movementData.clientId, movementData.type, locations]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;

    if (name === 'type') {
      resetForm(value as MovementType);
      return;
    }

    const numericFields = ['nbCaisse', 'poidsBrut', 'prixUnitaire', 'nbCaisseRetournees', 'montantTotal'];

    if (type === 'checkbox') {
      setMovementData(prev => ({ ...prev, [name]: checked }));
    } else if (numericFields.includes(name)) {
      setMovementData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setMovementData(prev => ({ ...prev, [name]: value }));
    }
  };

  const clientBalances = useMemo(() => {
    if (!movementData.clientId) {
      return { totalCratesOwned: 0, cratesInLocation: 0, availableEmptyCrates: 0 };
    }

    // When editing, we calculate the balance based on history *excluding* the current movement
    const relevantMovements = movementToEdit
      ? movements.filter(m => m.id !== movementToEdit.id)
      : movements;

    const totalCratesOwnedByClient = relevantMovements
      .filter(m => m.clientId === movementData.clientId)
      .reduce((balance, m) => {
        if (m.type === MovementType.EmptyCratesOut) return balance + m.nbCaisse;
        if (m.type === MovementType.EmptyCratesReturn || m.type === MovementType.LocationOut || m.type === MovementType.Sale) return balance - m.nbCaisse;
        return balance;
      }, 0);

    const cratesCurrentlyInLocation = locations
      .filter(l => l.clientId === movementData.clientId && l.status === 'En cours')
      .reduce((sum, l) => {
        // If we are editing the movement that created this location, exclude it from the sum
        if (movementToEdit && movementToEdit.id === l.id) {
          return sum;
        }
        return sum + l.nbCaisse;
      }, 0);

    const availableEmptyCrates = Math.max(0, totalCratesOwnedByClient - cratesCurrentlyInLocation);

    return { totalCratesOwned: totalCratesOwnedByClient, cratesInLocation: cratesCurrentlyInLocation, availableEmptyCrates };
  }, [movementData.clientId, movements, locations, movementToEdit]);

  const clientPaidCaution = useMemo(() => {
    if (!movementData.clientId || !reglements || !movements) return 0;
    return reglements
      .filter(r => {
        if (r.clientId !== movementData.clientId) return false;
        if (r.invoiceId) {
          const m = movements.find(mov => mov.id === r.invoiceId);
          return m && m.type === MovementType.EmptyCratesOut;
        }
        return r.notes && r.notes.includes('Dépôt de caution caisses vides');
      })
      .reduce((sum, r) => sum + r.amount, 0);
  }, [movementData.clientId, reglements, movements]);

  const maxCratesCoveredByCaution = useMemo(() => {
    const rate = Number(settings.cautionPerCrate) || 15;
    return Math.floor(clientPaidCaution / rate);
  }, [clientPaidCaution, settings.cautionPerCrate]);

  const remainingCrateAuthorization = useMemo(() => {
    return Math.max(0, maxCratesCoveredByCaution - clientBalances.availableEmptyCrates);
  }, [maxCratesCoveredByCaution, clientBalances.availableEmptyCrates]);

  const roomOccupancy = useMemo(() => {
    const occupancyMap = new Map<string, number>();
    locations.forEach(loc => {
      if (loc.status === 'En cours') {
        if (movementToEdit && movementToEdit.id === loc.id) return;
        occupancyMap.set(loc.roomId, (occupancyMap.get(loc.roomId) || 0) + loc.nbCaisse);
      }
    });
    return occupancyMap;
  }, [locations, movementToEdit]);

  const currentBatchStock = useMemo(() => {
    const { clientId, productId, roomId } = movementData as any;
    if (!clientId || !productId || !roomId) return null;
    
    let stock = locations
      .filter(l => l.clientId === clientId && l.status === 'En cours' && l.productId === productId && l.roomId === roomId)
      .reduce((sum, l) => sum + l.nbCaisse, 0);

    // If editing a withdrawal, we must "add back" its own quantity to show the true available total
    if (movementToEdit && (movementToEdit.type === MovementType.Sale || movementToEdit.type === MovementType.LocationOut)) {
        const oldProductId = movementToEdit.productId;
        const oldRoomId = (movementToEdit as any).roomId;
        
        // Match if same IDs OR if either is missing (legacy)
        const isSameProduct = !oldProductId || !productId || String(oldProductId) === String(productId);
        const isSameRoom = !oldRoomId || !roomId || String(oldRoomId) === String(roomId);

        if (isSameProduct && isSameRoom) {
            const oldQty = Number((movementToEdit as any).nbCaisse || (movementToEdit as any).nbCaisseRetournees || 0);
            stock += oldQty;
        }
    }
    
    return stock;
  }, [movementData, locations, movementToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentUser = authService.getCurrentUser();
    const isUserAdmin = currentUser?.role === 'admin';

    if (movementToEdit) {
      if (!isUserAdmin) {
        alert("Modification interdite : l'édition des opérations de stock est réservée aux administrateurs.");
        return;
      }
      const hasPayments = reglements && reglements.some(r => r.invoiceId === movementToEdit.id);
      if (hasPayments) {
        alert("Modification interdite : cette opération de stock a des règlements associés.");
        return;
      }
    }

    const client = clients.find(c => c.id === movementData.clientId);
    if (!client) { alert("Veuillez sélectionner un client."); return; }

    const { type } = movementData;
    const nbCaisse = (movementData as any).nbCaisse || 0;

    // --- Business Logic Validation ---
    if (type === MovementType.Sale || type === MovementType.LocationOut) {
      const productId = (movementData as any).productId;
      const roomId = (movementData as any).roomId;
      
      if (!productId) { alert("Veuillez sélectionner un produit."); return; }
      if (!roomId) { alert("Veuillez sélectionner une chambre."); return; }
      
      const exactStock = currentBatchStock || 0;

      if (nbCaisse > exactStock) {
        alert(`Erreur : Stock insuffisant dans cette chambre pour ce produit. Disponible au total: ${exactStock} caisses.`);
        return;
      }
    }

    if (type === MovementType.LocationIn) {
      const room = rooms.find(r => r.id === (movementData as MovementLocationIn).roomId);
      if (!room) { alert("Veuillez sélectionner une chambre."); return; }
      
      if (nbCaisse > clientBalances.availableEmptyCrates) {
        alert(`Opération bloquée : Le client ne dispose pas d'assez de caisses vides empruntées (${clientBalances.availableEmptyCrates} caisses disponibles) pour effectuer cette entrée en location de ${nbCaisse} caisses.`);
        return;
      }

      const currentOccupancy = roomOccupancy.get(room.id) || 0;
      if (nbCaisse > (room.nbCaisse - currentOccupancy)) {
        alert(`Capacité de la chambre dépassée. Espace disponible: ${room.nbCaisse - currentOccupancy} caisses.`);
        return;
      }
    }

    if (type === MovementType.EmptyCratesReturn) {
      if (nbCaisse > clientBalances.availableEmptyCrates) {
        alert(`Opération bloquée. Le client ne peut pas retourner plus de ${clientBalances.availableEmptyCrates} caisses (son solde de caisses vides disponibles).`);
        return;
      }
    }

    // The LocationOut stock validation is now grouped with Vente above!

    if (type === MovementType.EmptyCratesOut) {
      const maxAllowed = client.caissesReservees - clientBalances.totalCratesOwned;
      if (nbCaisse > maxAllowed) {
        alert(`Opération bloquée. Le client ne peut pas emprunter plus de ${maxAllowed} caisses (Quota: ${client.caissesReservees}, Possédées: ${clientBalances.totalCratesOwned}).`);
        return;
      }

      // Solde de caution validation
      const proposedEmptyCrates = clientBalances.availableEmptyCrates + nbCaisse;
      if (clientPaidCaution > 0 && proposedEmptyCrates > maxCratesCoveredByCaution) {
        alert(`Opération bloquée. Le client dispose d'une caution payée de ${clientPaidCaution} ${settings.currencySymbol}, ce qui couvre un maximum de ${maxCratesCoveredByCaution} caisses vides détenues en même temps.\n\nIl détient déjà ${clientBalances.availableEmptyCrates} caisses vides.\nQuantité demandée: ${nbCaisse} caisses (Total proposé: ${proposedEmptyCrates} caisses).\n\nVeuillez enregistrer un nouveau paiement de caution ou retourner des caisses.`);
        return;
      }

      const globalCratesInUse = movements.reduce((sum, m) => {
        if (m.type === MovementType.EmptyCratesOut) return sum + m.nbCaisse;
        if (m.type === MovementType.EmptyCratesReturn) return sum - m.nbCaisse;
        return sum;
      }, 0);
      const totalAvailable = (settings && Number(settings.totalAvailableCrates) > 0)
        ? Number(settings.totalAvailableCrates)
        : 1000;
      const availableCrates = totalAvailable - globalCratesInUse;

      if (nbCaisse > availableCrates) {
        const disponible = Math.max(0, availableCrates);
        alert(
          `Stock global de caisses insuffisant.\n\n` +
          `• Quantité demandée : ${nbCaisse} caisse(s)\n` +
          `• Caisses disponibles : ${disponible} caisse(s)\n` +
          `• Stock total configuré : ${totalAvailable} caisse(s)\n` +
          `• Caisses actuellement sorties/utilisées : ${globalCratesInUse} caisse(s)\n\n` +
          `Pour augmenter la capacité totale de caisses, vous pouvez modifier le "Stock Total Caisses" dans la page Paramètres.`
        );
        return;
      }
    }
    // --- End Validation ---

    console.log("Submitting movement data:", movementData);
    try {
      const currentUser = authService.getCurrentUser();
      const updatedBy = currentUser ? currentUser.email : 'Inconnu';
      if (movementToEdit) {
        await movementService.updateMovement({ ...movementToEdit, ...movementData, updatedBy } as Movement);
      } else {
        await movementService.addMovement({ ...movementData, updatedBy } as any);
      }
      onSave();
    } catch (error: any) {
      console.error("Error saving movement:", error);
      alert(`Erreur lors de l'enregistrement : ${error.message || 'Erreur inconnue'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-800 border-b pb-3">{movementToEdit ? 'Éditer le Mouvement' : 'Ajouter un Mouvement'}</h3>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Common Fields */}
            <select name="type" value={movementData.type} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
              {Object.values(MovementType).map(mt => <option key={mt} value={mt}>{mt}</option>)}
            </select>
            <select name="clientId" value={movementData.clientId} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required>
              <option value="">Sélectionnez un client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>)}
            </select>

            {/* Conditional Fields */}
            {[MovementType.Sale, MovementType.LocationIn, MovementType.LocationOut].includes(movementData.type!) && (
              <select name="productId" value={(movementData as any).productId || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required>
                <option value="">Sélectionnez un produit</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            )}

            {[MovementType.Sale, MovementType.LocationIn, MovementType.LocationOut].includes(movementData.type!) && (
              <select name="roomId" value={(movementData as any).roomId || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required>
                <option value="">Sélectionnez une chambre</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
              </select>
            )}

            {[MovementType.Sale, MovementType.LocationIn, MovementType.EmptyCratesOut, MovementType.EmptyCratesReturn, MovementType.LocationOut].includes(movementData.type!) && (
              <div className="space-y-1">
                <input type="number" name="nbCaisse" value={(movementData as any).nbCaisse || ''} onChange={handleChange} placeholder="Nombre de Caisses" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" min="1" required />
                {currentBatchStock !== null && (movementData.type === MovementType.Sale || movementData.type === MovementType.LocationOut) && (
                  <p className="text-xs font-semibold text-primary-600 pl-1">
                    Stock disponible pour ce lot : {currentBatchStock} caisses
                  </p>
                )}
              </div>
            )}

            {/* Section for Sales */}
            {movementData.type === MovementType.Sale && (
              <div className="p-4 border rounded-md bg-gray-50 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" step="0.01" name="poidsBrut" value={(movementData as any).poidsBrut || ''} onChange={handleChange} placeholder="Poids Brut (kg)" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required />
                  <input type="number" step="0.01" name="prixUnitaire" value={(movementData as any).prixUnitaire || ''} onChange={handleChange} placeholder="Prix Unitaire / kg" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required />
                </div>
                <div className="text-sm space-y-1">
                   <p>Poids Net: <strong>{Math.round((movementData as MovementSale).poidsNet || 0)}</strong> kg</p>
                   <p>Loyer de Stockage estimé: <strong>{Math.round((movementData as any).loyer || 0)}</strong> {settings.currencySymbol}</p>
                   <p>Taxe ({settings.taxRate}%): <strong>{Math.round((movementData as MovementSale).taxe || 0)}</strong> {settings.currencySymbol}</p>
                   <p className="text-lg font-bold text-primary-700">Total Facturé: {Math.round((movementData as MovementSale).montantTotal || 0)} {settings.currencySymbol}</p>
                </div>
              </div>
            )}

            {/* Section for Location Out */}
            {movementData.type === MovementType.LocationOut && (
              <div className="p-4 border rounded-md bg-gray-50 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Prix unitaire configuré</label>
                    <div className="mt-1 py-2 px-3 bg-gray-100 rounded-md shadow-sm text-gray-600 font-medium">
                        {settings.rentPerCratePerDay || '0'} {settings.currencySymbol}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Loyer calculé</label>
                    <div className="mt-1 py-2 px-3 bg-gray-100 rounded-md shadow-sm text-gray-600 font-medium">
                        {Math.round((movementData as MovementLocationOut).loyer || 0)} {settings.currencySymbol}
                    </div>
                  </div>
                </div>
                <div className="text-sm space-y-1 pt-1">
                   <p className="text-lg font-bold text-primary-700">Montant Total à payer: {Math.round((movementData as MovementLocationOut).montantTotal || 0)} {settings.currencySymbol}</p>
                </div>
                <label><input type="checkbox" name="cautionAppliquee" checked={!!(movementData as MovementLocationOut).cautionAppliquee} onChange={handleChange} /> Appliquer la caution</label>
                {movementData.cautionAppliquee && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                    <p>Caution à déduire ({settings.cautionPerCrate} {settings.currencySymbol}/caisse) : <strong>{Math.round((movementData as any).caution || 0)}</strong> {settings.currencySymbol}</p>
                    <p className="text-xs text-blue-600 mt-1">Cette caution sera remboursée ou déduite du montant total.</p>
                  </div>
                )}
              </div>
            )}

            {/* Section for Empty Crates Out */}
            {movementData.type === MovementType.EmptyCratesOut && (
              <div className="p-4 border rounded-xl bg-gray-50/70 space-y-3" id="empty-crates-caution-details">
                <p className="font-semibold text-gray-700 text-sm">Caution de Sortie de Caisses Vides :</p>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <span className="text-gray-500">Caution de cette sortie :</span>
                  <span className="font-bold text-right text-gray-800">{Math.round((movementData as MovementEmptyCratesOut).caution || 0)} {settings.currencySymbol}</span>

                  <span className="text-gray-500">Caution déjà payée par le client :</span>
                  <span className="font-bold text-right text-emerald-600">{Math.round(clientPaidCaution)} {settings.currencySymbol}</span>

                  <span className="text-gray-500">Caisses couvertes par caution payée :</span>
                  <span className="font-bold text-right text-blue-600">{maxCratesCoveredByCaution} caisses</span>

                  <span className="text-gray-500">Caisses vides détenues actuellement :</span>
                  <span className="font-bold text-right text-orange-600">{clientBalances.availableEmptyCrates} caisses</span>

                  <span className="text-gray-500 font-semibold border-t border-dashed pt-2 mt-1">Autorisation restante :</span>
                  <span className="font-bold text-right text-primary-600 border-t border-dashed pt-2 mt-1">{remainingCrateAuthorization} caisses</span>
                </div>
                {clientPaidCaution > 0 && remainingCrateAuthorization <= 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-xl flex items-start space-x-2">
                    <svg className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Le client a atteint sa limite de caisses couvertes par sa caution payée. Veuillez enregistrer un nouveau paiement de caution ou retourner des caisses pour libérer de l'autorisation.</span>
                  </div>
                )}
                {clientPaidCaution === 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-100 text-blue-800 text-xs rounded-xl flex items-start space-x-2">
                    <svg className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Cette sortie créera une facture de caution de <strong>{Math.round((movementData as MovementEmptyCratesOut).caution || 0)} {settings.currencySymbol}</strong>. Le client devra payer cette facture pour couvrir ces caisses.</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 flex justify-end space-x-2">
              <button type="button" onClick={onClose} className="py-2 px-4 bg-white border rounded-md">Annuler</button>
              <button type="submit" className="py-2 px-4 text-white bg-primary-600 rounded-md">{movementToEdit ? 'Mettre à Jour' : 'Enregistrer'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddMovementModal;
