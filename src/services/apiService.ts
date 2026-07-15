// Since frontend and backend are merged into a single instance on port 3000,
// we use port 3000 as the primary endpoint.
const isNative = typeof window !== 'undefined' && (!window.location.protocol.startsWith('http') || (window.location.hostname === 'localhost' && window.location.port === ''));
const BASE_URL = isNative
  ? 'http://85.215.215.242:3000/api'
  : '/api';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        // Attempt to get a more detailed error message from the response body
        let errorMessage;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            try {
                const errorJson = await response.json();
                errorMessage = errorJson.message || JSON.stringify(errorJson);
            } catch (e) {
                errorMessage = `Failed to parse JSON error response. Status: ${response.status}`;
            }
        } else {
            try {
                const errorText = await response.text();
                // FIX: Check if the error text is HTML and provide a clean message instead.
                if (errorText && errorText.trim().toLowerCase().startsWith('<html>')) {
                    errorMessage = `Le serveur a retourné une erreur inattendue (Statut: ${response.status} ${response.statusText}).`;
                } else {
                    errorMessage = errorText || `An API error occurred. Status: ${response.status}`;
                }
            } catch (e) {
                 errorMessage = `An API error occurred. Status: ${response.status}`;
            }
        }
        throw new Error(errorMessage);
    }

    // Handle successful responses
    if (response.status === 204) { // 204 No Content
        return Promise.resolve(undefined as T);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        const text = await response.text();
        // Handle empty body for JSON responses which is valid
        return text ? JSON.parse(text) : ({} as T);
    }

    return Promise.resolve(undefined as T);
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const config: RequestInit = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    };

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, config);
        return handleResponse<T>(response);
    } catch (error) {
        console.error('API Fetch Error:', error);
        // This primarily catches network errors or CORS failures that prevent a response.
        if (error instanceof TypeError) { 
             throw new Error("Erreur de réseau : Impossible de contacter le serveur. Veuillez vérifier votre connexion et que le serveur backend est en cours d'exécution.");
        }
        // Re-throw application-level errors from handleResponse
        throw error;
    }
}

export const apiService = {
    get: <T>(endpoint: string): Promise<T> => {
        return apiFetch<T>(endpoint, { method: 'GET' });
    },
    post: <T>(endpoint: string, data: unknown): Promise<T> => {
        return apiFetch<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    put: <T>(endpoint: string, data: unknown): Promise<T> => {
        return apiFetch<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    delete: <T>(endpoint: string): Promise<T> => {
        return apiFetch<T>(endpoint, { method: 'DELETE' });
    },
};