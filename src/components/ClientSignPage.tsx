import React, { useState, useEffect } from 'react';
import SignaturePad from './SignaturePad';

interface ContractData {
  id: string;
  date: string;
  clientId: string;
  type: string;
  nbCaisse: number;
  caution: number;
  avance: number;
  periode: string;
  status: string;
  signature?: string;
  signedAt?: string;
  companyName?: string;
  currencySymbol?: string;
}

const ClientSignPage: React.FC<{ contractId: string }> = ({ contractId }) => {
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);

  const fetchContract = async () => {
    try {
      const res = await fetch(`/api/contracts/public/${contractId}`);
      if (!res.ok) throw new Error('Contrat introuvable');
      const data = await res.json();
      setContract(data);
      if (data.signature) setSigned(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContract();
  }, [contractId]);

  const handleSign = async () => {
    if (!signatureData || !contract) {
      alert('Veuillez dessiner votre signature avant de valider.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contracts/public/${contractId}/sign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: signatureData })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de la signature');
      }
      setSigned(true);
      setSignatureData(null);
      await fetchContract();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du contrat...</p>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Contrat introuvable</h2>
          <p className="text-gray-600">{error || 'Ce lien est invalide ou le contrat a été supprimé.'}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-green-500 text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Contrat signé !</h2>
          <p className="text-gray-600 mb-4">Les signatures électroniques ont été enregistrées avec succès.</p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            <p className="font-semibold">📋 Référence : #{contract.id.substring(0, 8).toUpperCase()}</p>
            <p>🕐 Horodatage final : {contract.signedAt ? new Date(contract.signedAt).toLocaleString('fr-TN') : new Date().toLocaleString('fr-TN')}</p>
          </div>
          <p className="text-xs text-gray-400 mt-6">Vous pouvez fermer cette page. Les exemplaires PDF ont été envoyés par e-mail.</p>
        </div>
      </div>
    );
  }

  const currency = contract.currencySymbol || 'DT';
  const company = contract.companyName || 'L\'entreprise';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-indigo-700 rounded-xl p-5 text-white mb-4 shadow-lg">
          <h1 className="text-xl font-bold mb-1">📄 Signature de contrat</h1>
          <p className="text-sm opacity-90">{company} — Réf. #{contract.id.substring(0, 8).toUpperCase()}</p>
        </div>

        {/* Contract details */}
        <div className="bg-white rounded-xl shadow-md p-5 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Détails du contrat</h2>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-medium text-gray-800">{contract.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-800">{new Date(contract.date).toLocaleDateString('fr-TN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Nombre de caisses</span>
              <span className="font-medium text-gray-800">{contract.nbCaisse}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Période</span>
              <span className="font-medium text-gray-800">{contract.periode}</span>
            </div>
            <hr />
            <div className="flex justify-between">
              <span className="text-gray-500">Caution</span>
              <span className="font-bold text-gray-900">{contract.caution} {currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Avance</span>
              <span className="font-bold text-gray-900">{contract.avance} {currency}</span>
            </div>
          </div>
        </div>

        {/* Signature pad area */}
        <div className="bg-white rounded-xl shadow-md p-5 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            ✍️ Signature de votre contrat
          </h2>
          <p className="text-xs text-gray-500 mb-3">Dessinez votre signature ci-dessous avec le doigt ou un stylet</p>
          
          <SignaturePad
            onSave={(dataUrl) => setSignatureData(dataUrl)}
            onClear={() => setSignatureData(null)}
            height="200px"
          />

          {signatureData && (
            <div className="mt-2 flex items-center text-xs text-green-600">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Signature capturée
            </div>
          )}
        </div>

        {/* Legal notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
          ⚖️ En signant, vous acceptez les termes du contrat conformément au Code des Obligations et des Contrats tunisien (COC). La signature sera horodatée automatiquement.
        </div>

        {/* Submit button */}
        <button
          onClick={handleSign}
          disabled={!signatureData || submitting}
          className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
            signatureData && !submitting
              ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Enregistrement en cours...
            </span>
          ) : (
            '✅ Valider ma signature'
          )}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          Document sécurisé • Conforme au droit tunisien • Horodatage cryptographique
        </p>
      </div>
    </div>
  );
};

export default ClientSignPage;
