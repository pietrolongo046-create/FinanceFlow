const api = {
  // Funzione per caricare la lista dei conti (usata nel map della sidebar)
  getAccounts: async () => {
    // Ritorna un array vuoto o dati di prova per sbloccare la build
    return [
      { id: 1, name: 'Conto Principale', balance: 0, color: '#4f2d80' }
    ];
  }
};

export default api;