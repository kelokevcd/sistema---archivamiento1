// Elementos del DOM
const searchInput = document.getElementById('search-input');
const yearFilter = document.getElementById('year-filter');
const categoryFilter = document.getElementById('category-filter');
const dateFilter = document.getElementById('date-filter');
const gridViewBtn = document.getElementById('grid-view');
const listViewBtn = document.getElementById('list-view');
const diariesContainer = document.getElementById('diaries-container');
const uploadButton = document.getElementById('upload-button');
const uploadFirstDiary = document.getElementById('upload-first-diary');
const uploadModal = document.getElementById('upload-modal');
const statsButton = document.getElementById('stats-button');
const statsModal = document.getElementById('stats-modal');
const databaseButton = document.getElementById('database-button');
const uploadForm = document.getElementById('upload-form');
const closeButtons = document.querySelectorAll('.close');

// Estado de la aplicación
let diaries = [];
let filteredDiaries = [];
let categories = new Set();
let years = new Set();

// Inicialización
// Inicialización (línea 25-29)
document.addEventListener('DOMContentLoaded', async () => {
    await loadDiariesFromStorage(); // Cambiado a async/await para IndexedDB
    setupEventListeners();
    updateUI();
});

// Eliminar la función antigua de localStorage (líneas 32-48)
// La función correcta está en las líneas 286-319 que usa IndexedDB
// Cargar diarios desde localStorage
// function loadDiariesFromStorage() {
//     const storedDiaries = localStorage.getItem('diaries');
//     if (storedDiaries) {
//         diaries = JSON.parse(storedDiaries);
//         filteredDiaries = [...diaries];
//         
//         diaries.forEach(diary => {
//             categories.add(diary.category);
//             const year = new Date(diary.date).getFullYear();
//             years.add(year);
//         });
//         
//         updateFilters();
//     }
// }

// Configurar event listeners
function setupEventListeners() {
    // Botones de vista
    gridViewBtn?.addEventListener('click', () => {
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        diariesContainer.className = 'diaries-grid';
    });
    
    listViewBtn?.addEventListener('click', () => {
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        diariesContainer.className = 'diaries-list';
    });
    
    // Filtros
    searchInput?.addEventListener('input', filterDiaries);
    yearFilter?.addEventListener('change', filterDiaries);
    categoryFilter?.addEventListener('change', filterDiaries);
    dateFilter?.addEventListener('change', filterDiaries);
    
    // Modales
    uploadButton?.addEventListener('click', () => {
        uploadModal.style.display = 'block';
    });
    
    uploadFirstDiary?.addEventListener('click', () => {
        uploadModal.style.display = 'block';
    });
    
    statsButton?.addEventListener('click', () => {
        updateStats();
        statsModal.style.display = 'block';
    });
    
    closeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // Formulario de subida
    uploadForm?.addEventListener('submit', handleDiaryUpload);
    
    // Botón de base de datos
    databaseButton?.addEventListener('click', () => {
        window.location.href = 'database-structure.html';
    });
}

// Manejar subida de diarios
// Nueva implementación con IndexedDB para almacenamiento masivo
class DiaryStorage {
    constructor() {
        this.dbName = 'DiaryDatabase';
        this.dbVersion = 1;
        this.storeName = 'diaries';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('title', 'title', { unique: false });
                }
            };
        });
    }

    async saveDiary(diary) {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        return store.add(diary);
    }

    async getAllDiaries() {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteDiary(id) {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        return store.delete(id);
    }

    async getStorageInfo() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage,
                available: estimate.quota,
                usedMB: Math.round(estimate.usage / 1024 / 1024),
                availableMB: Math.round(estimate.quota / 1024 / 1024)
            };
        }
        return null;
    }
}

// Instancia global del almacenamiento
const diaryStorage = new DiaryStorage();

// Función mejorada para manejar archivos grandes
async function handleDiaryUpload(e) {
    e.preventDefault();
    
    const title = document.getElementById('diary-title').value.trim();
    const category = document.getElementById('diary-category').value.trim();
    const date = document.getElementById('diary-date').value;
    const fileInput = document.getElementById('diary-file');
    const file = fileInput.files[0];
    
    // Validación mejorada
    if (!title || !category || !date || !file) {
        alert('Por favor, completa todos los campos');
        return;
    }
    
    // Validar tipo de archivo (solo PDF)
    if (file.type !== 'application/pdf') {
        alert('Solo se permiten archivos PDF');
        return;
    }
    
    // Nuevo límite: 100MB (vs 10MB anterior)
    const maxSize = 100 * 1024 * 1024; // 100MB en bytes
    if (file.size > maxSize) {
        alert('El archivo es demasiado grande. Tamaño máximo: 100MB');
        return;
    }
    
    // Verificar espacio disponible
    const storageInfo = await diaryStorage.getStorageInfo();
    if (storageInfo && (storageInfo.available - storageInfo.used) < file.size * 2) {
        alert(`Espacio insuficiente. Disponible: ${storageInfo.availableMB}MB, Necesario: ${Math.round(file.size * 2 / 1024 / 1024)}MB`);
        return;
    }
    
    // Mostrar indicador de carga con progreso
    const submitButton = document.querySelector('#upload-form button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.innerHTML = '<span>Subiendo... <span id="upload-progress">0%</span></span>';
    submitButton.disabled = true;
    
    try {
        // Convertir archivo con progreso
        const fileData = await readFileWithProgress(file);
        
        // Crear nuevo diario
        const newDiary = {
            id: Date.now().toString(),
            title,
            category,
            date,
            fileData,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            uploadDate: new Date().toISOString()
        };
        
        // Guardar en IndexedDB
        await diaryStorage.saveDiary(newDiary);
        
        // Actualizar UI
        await loadDiariesFromStorage();
        updateFilters();
        updateUI();
        
        // Restaurar botón y cerrar modal
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        uploadModal.style.display = 'none';
        uploadForm.reset();
        
        // Mostrar información de almacenamiento
        const updatedStorageInfo = await diaryStorage.getStorageInfo();
        alert(`Archivo subido exitosamente!\n\nEspacio usado: ${updatedStorageInfo.usedMB}MB / ${updatedStorageInfo.availableMB}MB`);
        
    } catch (error) {
        console.error('Error al subir archivo:', error);
        alert('Error al subir el archivo: ' + error.message);
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// Función para leer archivo con indicador de progreso
function readFileWithProgress(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const progressElement = document.getElementById('upload-progress');
        
        reader.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                if (progressElement) {
                    progressElement.textContent = percentComplete + '%';
                }
            }
        };
        
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        
        reader.readAsDataURL(file);
    });
}

// Función mejorada para cargar diarios desde IndexedDB
// Esta función YA está implementada y es la correcta
async function loadDiariesFromStorage() {
    try {
        // Inicializar IndexedDB si no está inicializado
        if (!diaryStorage.db) {
            await diaryStorage.init();
            
            // Migrar datos desde localStorage si existen
            await migrateFromLocalStorage();
        }
        
        // Cargar diarios desde IndexedDB
        diaries = await diaryStorage.getAllDiaries();
        filteredDiaries = [...diaries];
        
        // Extraer categorías y años únicos
        categories.clear();
        years.clear();
        
        diaries.forEach(diary => {
            categories.add(diary.category);
            const year = new Date(diary.date).getFullYear();
            years.add(year);
        });
        
    } catch (error) {
        console.error('Error al cargar diarios:', error);
        // Fallback a localStorage si IndexedDB falla
        const savedDiaries = localStorage.getItem('diaries');
        if (savedDiaries) {
            diaries = JSON.parse(savedDiaries);
            filteredDiaries = [...diaries];
        }
    }
}

// Función para migrar datos desde localStorage
async function migrateFromLocalStorage() {
    const savedDiaries = localStorage.getItem('diaries');
    if (savedDiaries) {
        try {
            const oldDiaries = JSON.parse(savedDiaries);
            
            for (const diary of oldDiaries) {
                await diaryStorage.saveDiary(diary);
            }
            
            // Limpiar localStorage después de la migración exitosa
            localStorage.removeItem('diaries');
            console.log(`Migrados ${oldDiaries.length} diarios desde localStorage a IndexedDB`);
            
        } catch (error) {
            console.error('Error en migración:', error);
        }
    }
}

// Función para eliminar diario (actualizada para IndexedDB)
async function deleteDiary(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este diario?')) {
        try {
            await diaryStorage.deleteDiary(id);
            await loadDiariesFromStorage();
            updateFilters();
            updateUI();
            alert('Diario eliminado exitosamente');
        } catch (error) {
            console.error('Error al eliminar diario:', error);
            alert('Error al eliminar el diario');
        }
    }
}

// Crear tarjeta de diario
function createDiaryCard(diary) {
    const card = document.createElement('div');
    card.className = 'diary-card';
    
    // Usar fileData para archivos Base64
    const fileData = diary.fileData || diary.fileURL;
    
    const formattedDate = new Date(diary.date).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const uploadDate = new Date(diary.uploadDate).toLocaleDateString('es-ES');
    
    card.innerHTML = `
        <div class="diary-header">
            <h3>${diary.title}</h3>
            <button class="delete-btn" onclick="deleteDiary('${diary.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="diary-info">
            <p><strong>Categoría:</strong> ${diary.category}</p>
            <p><strong>Fecha:</strong> ${formattedDate}</p>
            <p><strong>Archivo:</strong> ${diary.fileName}</p>
            <p><strong>Subido:</strong> ${uploadDate}</p>
        </div>
        <div class="diary-actions">
            <button class="view-btn" onclick="viewDiary('${fileData}', '${diary.fileName}')">
                <i class="fas fa-eye"></i> Ver PDF
            </button>
            <button class="download-btn" onclick="downloadDiary('${fileData}', '${diary.fileName}')">
                <i class="fas fa-download"></i> Descargar
            </button>
        </div>
    `;
    
    return card;
}

// Ver diario
function viewDiary(fileData, fileName) {
    if (fileData && fileData.startsWith('data:')) {
        // Archivo Base64 - crear blob URL temporal para visualización
        try {
            const byteCharacters = atob(fileData.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            // Abrir en nueva ventana
            window.open(url, '_blank');
            
            // Limpiar URL después de un tiempo
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (error) {
            alert('Error al abrir el archivo PDF');
            console.error('Error:', error);
        }
    } else {
        // URL temporal (compatibilidad)
        window.open(fileData, '_blank');
    }
}

// Descargar diario
function downloadDiary(fileData, fileName) {
    if (fileData && fileData.startsWith('data:')) {
        // Archivo Base64 - crear enlace de descarga
        const link = document.createElement('a');
        link.href = fileData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        // URL temporal (compatibilidad)
        const link = document.createElement('a');
        link.href = fileData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Actualizar filtros
function updateFilters() {
    // Actualizar filtro de años
    if (yearFilter) {
        yearFilter.innerHTML = '<option value="">Todos los años</option>';
        [...years].sort((a, b) => b - a).forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearFilter.appendChild(option);
        });
    }
    
    // Actualizar filtro de categorías
    if (categoryFilter) {
        categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
        [...categories].sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            categoryFilter.appendChild(option);
        });
    }
}

// Filtrar diarios
function filterDiaries() {
    const searchTerm = searchInput?.value.toLowerCase() || '';
    const selectedYear = yearFilter?.value || '';
    const selectedCategory = categoryFilter?.value || '';
    const selectedDate = dateFilter?.value || '';
    
    filteredDiaries = diaries.filter(diary => {
        const matchesSearch = diary.title.toLowerCase().includes(searchTerm) || 
                            diary.category.toLowerCase().includes(searchTerm);
        const matchesYear = !selectedYear || new Date(diary.date).getFullYear().toString() === selectedYear;
        const matchesCategory = !selectedCategory || diary.category === selectedCategory;
        const matchesDate = !selectedDate || diary.date === selectedDate;
        
        return matchesSearch && matchesYear && matchesCategory && matchesDate;
    });
    
    updateUI();
}

// Actualizar interfaz de usuario
function updateUI() {
    if (!diariesContainer) return;
    
    diariesContainer.innerHTML = '';
    
    if (filteredDiaries.length === 0) {
        if (diaries.length === 0) {
            diariesContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-pdf"></i>
                    <h3>No hay diarios archivados</h3>
                    <p>Comienza subiendo tu primer diario</p>
                    <button id="upload-first-diario" class="btn btn-primary">
                        <i class="fas fa-plus"></i> Subir Primer Diario
                    </button>
                </div>
            `;
            
            // Reconfigurar event listener para el botón
            const newUploadFirstDiary = document.getElementById('upload-first-diary');
            newUploadFirstDiary?.addEventListener('click', () => {
                uploadModal.style.display = 'none';
            });
        } else {
            diariesContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No se encontraron diarios</h3>
                    <p>Intenta ajustar los filtros de búsqueda</p>
                </div>
            `;
        }
    } else {
        filteredDiaries.forEach(diary => {
            const card = createDiaryCard(diary);
            diariesContainer.appendChild(card);
        });
    }
}

// Eliminar diario
function deleteDiary(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este diario?')) {
        diaries = diaries.filter(diary => diary.id !== id);
        filteredDiaries = filteredDiaries.filter(diary => diary.id !== id);
        
        // Recalcular categorías y años
        recalculateCategoriesAndYears();
        
        // Guardar cambios
        saveDiariesToStorage();
        
        // Actualizar UI
        updateFilters();
        updateUI();
    }
}

// Recalcular categorías y años
function recalculateCategoriesAndYears() {
    categories.clear();
    years.clear();
    
    diaries.forEach(diary => {
        categories.add(diary.category);
        const year = new Date(diary.date).getFullYear();
        years.add(year);
    });
}

// Actualizar estadísticas
function updateStats() {
    const totalDiaries = diaries.length;
    const categoriesCount = categories.size;
    const yearsCount = years.size;
    
    // Calcular estadísticas por categoría
    const categoryStats = {};
    diaries.forEach(diary => {
        categoryStats[diary.category] = (categoryStats[diary.category] || 0) + 1;
    });
    
    // Actualizar elementos del DOM
    const totalElement = document.getElementById('total-diaries');
    const categoriesElement = document.getElementById('total-categories');
    const yearsElement = document.getElementById('total-years');
    
    if (totalElement) totalElement.textContent = totalDiaries;
    if (categoriesElement) categoriesElement.textContent = categoriesCount;
    if (yearsElement) yearsElement.textContent = yearsCount;
    
    // Crear gráfico
    createChart(categoryStats);
}

// Crear gráfico de estadísticas
function createChart(categoryStats) {
    const canvas = document.getElementById('stats-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const categories = Object.keys(categoryStats);
    const values = Object.values(categoryStats);
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (categories.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No hay datos para mostrar', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Configuración del gráfico
    const maxValue = Math.max(...values);
    const barWidth = canvas.width / categories.length - 20;
    const barMaxHeight = canvas.height - 60;
    
    // Dibujar barras
    categories.forEach((category, index) => {
        const value = values[index];
        const barHeight = (value / maxValue) * barMaxHeight;
        const x = index * (barWidth + 20) + 10;
        const y = canvas.height - barHeight - 30;
        
        // Barra
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Etiqueta de categoría
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(category, x + barWidth / 2, canvas.height - 10);
        
        // Valor
        ctx.fillStyle = '#666';
        ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
    });
}