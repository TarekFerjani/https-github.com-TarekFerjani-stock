import React, { useState, useEffect } from 'react';
import { Settings } from '../types';
import { settingsService } from '../services/settingsService';
import SignaturePad from './SignaturePad';

interface SettingsPageProps {
    settings: Settings;
    onSave: () => void;
    onResetData: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSave, onResetData }) => {
    const [currentSettings, setCurrentSettings] = useState<Settings>(settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingDb, setIsSavingDb] = useState(false);
    const [dbStatus, setDbStatus] = useState<{ ok: boolean, message: string } | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [dbConfig, setDbConfig] = useState({
        DB_HOST: '',
        DB_PORT: '5432',
        DB_USER: '',
        DB_PASSWORD: '',
        DB_DATABASE: ''
    });

    useEffect(() => {
        setCurrentSettings(settings);
    }, [settings]);

    useEffect(() => {
        const fetchDbConfig = async () => {
            try {
                const config = await settingsService.getDbConfig();
                setDbConfig({
                    DB_HOST: config.DB_HOST || '',
                    DB_PORT: config.DB_PORT || '5432',
                    DB_USER: config.DB_USER || '',
                    DB_PASSWORD: config.DB_PASSWORD || '',
                    DB_DATABASE: config.DB_DATABASE || ''
                });
            } catch (err) {
                console.error("Failed to load DB config", err);
            }
        };
        fetchDbConfig();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const numericFields = ['cautionPerCrate', 'emptyCrateWeight', 'taxRate', 'rentPerCratePerDay', 'totalAvailableCrates'];
        setCurrentSettings(prev => ({ ...prev, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value }));
    };

    const handleDbConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDbConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentSettings(prev => ({ ...prev, companyLogo: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        await settingsService.saveSettings(currentSettings);
        setIsSaving(false);
        onSave();
        alert('Paramètres enregistrés avec succès !');
    };

    const handleSaveDbConfig = async () => {
        setIsSavingDb(true);
        try {
            await settingsService.saveDbConfig(dbConfig);
            alert('Configuration de la base de données enregistrée avec succès !');
        } catch (error: any) {
            alert('Erreur lors de l\'enregistrement : ' + (error.message || "Une erreur est survenue."));
        } finally {
            setIsSavingDb(false);
        }
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setDbStatus(null);
        try {
            const result = await settingsService.testDbConnection();
            setDbStatus(result);
        } catch (error: any) {
            setDbStatus({ ok: false, message: error.message || "Une erreur inconnue est survenue." });
        }
        setIsTesting(false);
    };
    
    const SettingsField: React.FC<{label: string, children: React.ReactNode}> = ({label, children}) => (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {children}
      </div>
    );

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-semibold text-gray-700">Paramètres de l'Application</h1>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 transition-all hover:shadow-lg">
                <div className="flex items-center space-x-3 border-b pb-3 mb-6 font-semibold text-gray-800">
                    <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                        </svg>
                    </div>
                    <h2 className="text-lg">Informations de l'Entreprise</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SettingsField label="Nom de l'entreprise">
                      <input type="text" name="companyName" value={currentSettings.companyName || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                    </SettingsField>
                    <SettingsField label="Matricule Fiscal">
                      <input type="text" name="fiscalId" value={currentSettings.fiscalId || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" />
                    </SettingsField>
                    <div className="md:col-span-2">
                       <SettingsField label="Adresse">
                          <textarea name="companyAddress" value={currentSettings.companyAddress || ''} onChange={handleChange} rows={2} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"></textarea>
                       </SettingsField>
                    </div>
                    <SettingsField label="Site Web">
                      <input type="text" name="companyWebsite" value={currentSettings.companyWebsite || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" />
                    </SettingsField>
                     <SettingsField label="Téléphone">
                       <input type="text" name="companyPhone" value={currentSettings.companyPhone || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" />
                     </SettingsField>
                     <SettingsField label="Email de l'entreprise">
                       <input type="email" name="companyEmail" value={currentSettings.companyEmail || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" />
                     </SettingsField>
                    <div className="md:col-span-2">
                      <SettingsField label="Logo de l'entreprise">
                          <input type="file" accept="image/png, image/jpeg" onChange={handleLogoChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"/>
                      </SettingsField>
                      {currentSettings.companyLogo && <img src={currentSettings.companyLogo} alt="Aperçu du logo" className="mt-4 h-16 object-contain border p-1 rounded-md" />}
                    </div>
                    <div className="md:col-span-2">
                      <SettingsField label="Signature de l'entreprise (pour les contrats)">
                          <SignaturePad 
                            onSave={(sig) => setCurrentSettings(prev => ({ ...prev, companySignature: sig }))} 
                            height="150px" 
                          />
                          {currentSettings.companySignature && (
                            <div className="mt-2 p-2 border rounded bg-gray-50">
                              <p className="text-xs text-gray-400 mb-1">Aperçu actuel:</p>
                              <img src={currentSettings.companySignature} alt="Signature actuelle" className="h-12 object-contain" />
                            </div>
                          )}
                      </SettingsField>
                    </div>
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 transition-all hover:shadow-lg">
                <div className="flex items-center space-x-3 border-b pb-3 mb-6 font-semibold text-gray-800">
                    <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                    </div>
                    <h2 className="text-lg">Paramètres des Produits et Locations</h2>
                </div>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                     <SettingsField label="Devise">
                        <input type="text" name="currencySymbol" value={currentSettings.currencySymbol || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" />
                     </SettingsField>
                     <SettingsField label="Taux TVA (%)">
                        <input type="number" name="taxRate" value={Math.round(currentSettings.taxRate || 0)} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" />
                     </SettingsField>
                      <SettingsField label="Loyer/Caisse/Jour">
                         <input type="number" step="1" name="rentPerCratePerDay" value={Math.round(currentSettings.rentPerCratePerDay || 0)} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" />
                      </SettingsField>
                     <SettingsField label="Caution par Caisse">
                        <input type="number" step="1" name="cautionPerCrate" value={Math.round(currentSettings.cautionPerCrate || 0)} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" />
                     </SettingsField>
                     <SettingsField label="Poids Caisse Vide (kg)">
                        <input type="number" step="1" name="emptyCrateWeight" value={Math.round(currentSettings.emptyCrateWeight || 0)} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" />
                     </SettingsField>
                     <SettingsField label="Stock Total Caisses">
                        <input type="number" name="totalAvailableCrates" value={Math.round(currentSettings.totalAvailableCrates || 0)} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" />
                     </SettingsField>
                 </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 transition-all hover:shadow-lg">
                <div className="flex items-center space-x-3 border-b pb-3 mb-6 font-semibold text-gray-800">
                    <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9s2.015-9 4.5-9m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
                        </svg>
                    </div>
                    <h2 className="text-lg">Connexion à la Base de Données</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <SettingsField label="Hôte de la Base de Données (DB_HOST)">
                        <input 
                            type="text" 
                            name="DB_HOST" 
                            value={dbConfig.DB_HOST} 
                            onChange={handleDbConfigChange} 
                            placeholder="ex. localhost, 127.0.0.1, ou hôte distant"
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" 
                        />
                    </SettingsField>
                    <SettingsField label="Port (DB_PORT)">
                        <input 
                            type="text" 
                            name="DB_PORT" 
                            value={dbConfig.DB_PORT} 
                            onChange={handleDbConfigChange} 
                            placeholder="ex. 5432"
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" 
                        />
                    </SettingsField>
                    <SettingsField label="Utilisateur de la Base de Données (DB_USER)">
                        <input 
                            type="text" 
                            name="DB_USER" 
                            value={dbConfig.DB_USER} 
                            onChange={handleDbConfigChange} 
                            placeholder="ex. postgres"
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" 
                        />
                    </SettingsField>
                    <SettingsField label="Nom de la Base de Données (DB_DATABASE)">
                        <input 
                            type="text" 
                            name="DB_DATABASE" 
                            value={dbConfig.DB_DATABASE} 
                            onChange={handleDbConfigChange} 
                            placeholder="ex. frigo_db"
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" 
                        />
                    </SettingsField>
                    <div className="md:col-span-2">
                        <SettingsField label="Mot de passe (DB_PASSWORD)">
                            <input 
                                type="password" 
                                name="DB_PASSWORD" 
                                value={dbConfig.DB_PASSWORD} 
                                onChange={handleDbConfigChange} 
                                placeholder="••••••••"
                                className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" 
                            />
                        </SettingsField>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t pt-4">
                    <div className="flex items-center space-x-3">
                        <button 
                            type="button"
                            onClick={handleSaveDbConfig} 
                            disabled={isSavingDb}
                            className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm transition-colors disabled:bg-gray-400"
                        >
                            {isSavingDb ? 'Enregistrement...' : 'Enregistrer la Config DB'}
                        </button>
                        <button 
                            type="button"
                            onClick={handleTestConnection} 
                            disabled={isTesting}
                            className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md shadow-sm transition-colors disabled:bg-gray-400"
                        >
                            {isTesting ? 'Test en cours...' : 'Tester la Connexion'}
                        </button>
                    </div>

                    {dbStatus && (
                        <div className={`p-2 rounded-md text-sm font-medium ${dbStatus.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            <strong>{dbStatus.ok ? 'Succès :' : 'Erreur :'}</strong> {dbStatus.message}
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-3">Cette configuration est sauvegardée dans le fichier d'environnement du serveur (<code>.env</code>) et utilisée pour la connexion PostgreSQL.</p>
            </div>

             <div className="flex justify-end pt-4">
                <button 
                  onClick={handleSave} 
                  disabled={isSaving} 
                  className="px-8 py-3 bg-primary-600 text-white font-bold rounded-lg shadow-md hover:bg-primary-700 hover:shadow-lg focus:ring-4 focus:ring-primary-100 transition-all disabled:bg-gray-400 flex items-center space-x-2"
                >
                    {isSaving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Enregistrement...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>Enregistrer les Paramètres</span>
                      </>
                    )}
                </button>
            </div>
            
            <div className="bg-red-50 p-6 rounded-lg shadow-md border border-red-200">
                <h2 className="text-lg font-semibold text-red-800">Zone de Danger</h2>
                <p className="text-sm text-red-700 mt-1">La réinitialisation supprimera tous les produits, clients, chambres et mouvements. Cette action est irréversible.</p>
                <button onClick={onResetData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Réinitialiser les Données</button>
            </div>

        </div>
    );
};

export default SettingsPage;