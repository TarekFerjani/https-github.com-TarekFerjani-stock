import React, { useState } from 'react';
import { Client, Contract } from '../types';

interface AddContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contract: Partial<Contract>) => void;
  clients: Client[];
}

const AddContractModal: React.FC<AddContractModalProps> = ({ isOpen, onClose, onSave, clients }) => {
  const [formData, setFormData] = useState<Partial<Contract>>({
    type: 'Location',
    nbCaisse: 1,
    caution: 0,
    avance: 0,
  });

  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) {
      alert('Veuillez sélectionner un client.');
      return;
    }

    if (!dateDebut || !dateFin) {
      alert('Veuillez sélectionner la période (début et fin).');
      return;
    }
    if (new Date(dateDebut) > new Date(dateFin)) {
      alert('La date de fin doit être supérieure ou égale à la date de début.');
      return;
    }
    const formattedStart = new Date(dateDebut).toLocaleDateString('fr-TN');
    const formattedEnd = new Date(dateFin).toLocaleDateString('fr-TN');
    const periodeStr = `Du ${formattedStart} au ${formattedEnd}`;
    onSave({ ...formData, periode: periodeStr });
  };

  const inputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Nouveau Contrat</h3>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Client + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Client (responsable du dossier)</label>
                <select
                  required
                  className={inputClass}
                  value={formData.clientId || ''}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className={labelClass}>Type de contrat</label>
                <select
                  className={inputClass}
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <option value="Location">📦 Location</option>
                  <option value="Prêt de caisses">🤝 Prêt de caisses</option>
                </select>
              </div>
            </div>

            {/* ─── LOCATION / PRÊT FIELDS ─── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nombre de Caisses</label>
                <input type="number" required min="1" className={inputClass}
                  value={formData.nbCaisse}
                  onChange={(e) => setFormData({ ...formData, nbCaisse: parseInt(e.target.value) })} />
              </div>
              <div>
                <label className={labelClass}>Caution (DT)</label>
                <input type="number" required step="1" className={inputClass}
                  value={formData.caution}
                  onChange={(e) => setFormData({ ...formData, caution: parseFloat(e.target.value) })} />
              </div>
              <div>
                <label className={labelClass}>Avance (DT)</label>
                <input type="number" step="1" className={inputClass}
                  value={formData.avance}
                  onChange={(e) => setFormData({ ...formData, avance: parseFloat(e.target.value) })} />
              </div>
              <div></div>
              <div>
                <label className={labelClass}>Date de début</label>
                <input type="date" required className={inputClass}
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Date de fin</label>
                <input type="date" required className={inputClass}
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)} />
              </div>
            </div>

            {/* Email notice */}
            <div className="border rounded-md p-3 text-sm bg-blue-50 border-blue-200 text-blue-700">
              E-mail automatique envoyé au client avec un lien pour signer le contrat depuis son mobile.
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button type="button" onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Annuler
              </button>
              <button type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700">
                📄 Générer et Envoyer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddContractModal;
