
export interface Product {
  id: string;
  nom: string;
  categorie: string;
  codeBarres?: string;
}

export interface Client {
  id: string;
  nom: string;
  prenom: string;
  cin: string;
  telephone?: string;
  email?: string;
  caissesReservees: number;
}

export interface Room {
  id: string;
  nom: string;
  nbCaisse: number; // Capacité totale
}

export interface Location {
  id: string; // Utilise l'ID du mouvement d'entrée
  clientId: string;
  productId: string;
  roomId: string;
  nbCaisse: number; // Nombre de caisses restantes dans cette location
  initialNbCaisse: number; // Nombre de caisses initial
  entryDate: string;
  exitDate: string | null;
  status: 'En cours' | 'Terminé';
}

export enum MovementType {
  // Entrée
  LocationIn = "Location",
  EmptyCratesReturn = "Retour caisses vides",
  // Sortie
  Sale = "Vente",
  LocationOut = "Fin de Location",
  EmptyCratesOut = "Caisses vides",
}

interface MovementBase {
  id: string;
  date: string;
  clientId: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type MovementLocationIn = MovementBase & {
  type: MovementType.LocationIn;
  productId: string;
  nbCaisse: number;
  roomId: string;
};

export type MovementEmptyCratesReturn = MovementBase & {
  type: MovementType.EmptyCratesReturn;
  nbCaisse: number;
};

export type MovementSale = MovementBase & {
  type: MovementType.Sale;
  productId: string;
  roomId: string; // Required to target specific stock
  nbCaisse: number;
  poidsBrut: number;
  prixUnitaire: number;
  poidsNet: number;
  montantTotal: number;
  taxe?: number;
};

export type MovementLocationOut = MovementBase & {
  type: MovementType.LocationOut;
  productId: string;
  roomId: string;
  nbCaisse: number; // For Fin de Location, this acts as the withdrawn quantity
  prixUnitaire?: number;
  loyer?: number;
  cautionAppliquee?: boolean;
  montantTotal?: number;
  paymentStatus?: 'Payé' | 'En attente';
};

export type MovementEmptyCratesOut = MovementBase & {
  type: MovementType.EmptyCratesOut;
  nbCaisse: number;
  caution?: number;
};

export type Movement =
  | MovementLocationIn
  | MovementEmptyCratesReturn
  | MovementSale
  | MovementLocationOut
  | MovementEmptyCratesOut;

export enum Role {
  admin = 'admin',
  user = 'user',
}

export interface User {
  id: string;
  email: string;
  password?: string;
  role: Role;
  permissions?: PagePermissions;
}

export type Page = 'dashboard' | 'clients' | 'products' | 'rooms' | 'locations' | 'stock' | 'factures' | 'reports' | 'settings' | 'users' | 'contrats' | 'reglements';

export interface Reglement {
  id: string;
  date: string;
  clientId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  invoiceId?: string | null;
  notes?: string;
}

export interface Avance {
  id: string;
  date: string;
  clientId: string;
  amount: number;
  paymentMethod: string;
  contractId?: string | null;
  notes?: string;
}

export interface Contract {
  id: string;
  date: string;
  clientId: string;
  type: 'Location' | 'Prêt de caisses';
  nbCaisse: number;
  caution: number;
  avance: number;
  periode: string;
  signature?: string; // Base64
  signedAt?: string; // ISO timestamp of electronic signature
  status: 'En attente' | 'Actif' | 'Terminé' | 'Annulé';
}

export type PagePermissions = {
  [key in Page]?: boolean;
};

export interface Settings {
  companyName: string;
  companyAddress: string;
  companyWebsite: string;
  companyPhone: string;
  companyEmail?: string;
  companyLogo: string; // base64 string
  fiscalId: string;
  currencySymbol: string;
  cautionPerCrate: number;
  emptyCrateWeight: number;
  taxRate: number; // e.g., 20 for 20%
  rentPerCratePerDay: number;
  totalAvailableCrates: number;
  companySignature?: string; // Base64
}

export interface Invoice {
  id: string; // movementId
  date: string;
  clientId: string;
  type: MovementType.Sale | MovementType.LocationOut;
  montantTotal?: number;
  loyer?: number;
  caution?: number;
  paymentStatus?: 'Payé' | 'En attente';
}

export interface DbConfig {
  DB_HOST?: string;
  DB_PORT?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_DATABASE?: string;
}
