import { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

const CATEGORIES = [
  { value: 'horarios', label: 'Horarios', icon: ' ' },
  { value: 'pagos', label: 'Pagos', icon: ' ' },
  { value: 'ubicacion', label: 'Ubicación', icon: ' ' },
  { value: 'tiempo', label: 'Tiempos', icon: '⏱️' },
  { value: 'servicios', label: 'Servicios', icon: ' ' },
  { value: 'proceso', label: 'Proceso', icon: ' ' },
  { value: 'faq', label: 'Preguntas Frecuentes', icon: '❓' },
  { value: 'problemas', label: 'Problemas/Quejas', icon: '⚠️' },
];

export default function AIKnowledgeBase() {
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    category: 'horarios',
    question: '',
    answer: '',
    is_active: true,
  });
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .select('*')
        .eq('store_id', user.id)
        .order('category')
        .order('sort_order');

      if (error) throw error;
      setKnowledge(data || []);
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const insertData = {
        store_id: user.id,
        category: formData.category,
        question: formData.question.trim(),
        answer: formData.answer.trim(),
        is_active: formData.is_active,
      };

      if (editingId) {
        const { error } = await supabase
          .from('ai_knowledge_base')
          .update(insertData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_knowledge_base')
          .insert(insertData);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ category: 'horarios', question: '', answer: '', is_active: true });
      await fetchKnowledge();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      category: item.category,
      question: item.question,
      answer: item.answer,
      is_active: item.is_active,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta entrada?')) return;
    try {
      const { error } = await supabase
        .from('ai_knowledge_base')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchKnowledge();
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Error al eliminar: ' + error.message);
    }
  };

  const handleToggleActive = async (id, currentValue) => {
    try {
      const { error } = await supabase
        .from('ai_knowledge_base')
        .update({ is_active: !currentValue })
        .eq('id', id);
      if (error) throw error;
      await fetchKnowledge();
    } catch (error) {
      console.error('Error toggling:', error);
    }
  };

  const filteredKnowledge = knowledge.filter(item => {
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.answer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryInfo = (cat) => CATEGORIES.find(c => c.value === cat) || { label: cat, icon: ' ' };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">  Base de Conocimiento IA</h2>
          <p className="text-gray-500 text-sm mt-1">
            Administra las preguntas frecuentes que el chatbot IA usará para responder
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setFormData({ category: 'horarios', question: '', answer: '', is_active: true }); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <span>+</span> Agregar Pregunta
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Buscar preguntas o respuestas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todas las categorías</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
          ))}
        </select>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-blue-600">{knowledge.length}</div>
          <div className="text-sm text-gray-500">Total entradas</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-600">{knowledge.filter(k => k.is_active).length}</div>
          <div className="text-sm text-gray-500">Activas</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="text-2xl font-bold text-yellow-600">{CATEGORIES.length}</div>
          <div className="text-sm text-gray-500">Categorías</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <div className="text-2xl font-bold text-purple-600">
            {knowledge.filter(k => k.category === 'faq').length}
          </div>
          <div className="text-sm text-gray-500">FAQs</div>
        </div>
      </div>

      {/* Lista de conocimiento */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Cargando...</p>
        </div>
      ) : filteredKnowledge.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-6xl mb-4"> </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No hay entradas</h3>
          <p className="text-gray-500">
            {searchTerm || filterCategory !== 'all' 
              ? 'No se encontraron resultados para tu búsqueda'
              : 'Agrega la primera pregunta frecuente para entrenar a tu chatbot IA'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredKnowledge.map((item) => {
            const catInfo = getCategoryInfo(item.category);
            return (
              <div 
                key={item.id} 
                className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                  item.is_active ? 'border-green-500' : 'border-gray-300 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{catInfo.icon}</span>
                      <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full">
                        {catInfo.label}
                      </span>
                      {!item.is_active && (
                        <span className="text-xs font-medium px-2 py-1 bg-red-100 text-red-600 rounded-full">
                          Inactiva
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-gray-800 mb-1">
                      ❓ {item.question}
                    </div>
                    <div className="text-gray-600 text-sm">
   {item.answer}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(item.id, item.is_active)}
                      className={`p-2 rounded-lg ${
                        item.is_active 
                          ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={item.is_active ? 'Desactivar' : 'Activar'}
                    >
                      {item.is_active ? '✓' : '○'}
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                {editingId ? '✏️ Editar Pregunta' : '➕ Nueva Pregunta'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pregunta del usuario</label>
                <input
                  type="text"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="Ej: ¿Qué horas abren?"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Respuesta de la IA</label>
                <textarea
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  placeholder="Ej: Nuestro horario es de lunes a sábado de 8am a 6pm."
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Entrada activa (la IA la usará para responder)
                </label>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.question.trim() || !formData.answer.trim() || saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ayuda */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="font-bold text-blue-800 mb-2">  ¿Cómo funciona?</h3>
        <ul className="text-sm text-blue-700 space-y-2">
          <li>• La IA del chatbot usará estas preguntas y respuestas para atender a tus clientes</li>
          <li>• Puedes agregar preguntas frecuentes que tus clientes suelen hacer</li>
          <li>• Las entradas inactivas no serán usadas por la IA</li>
          <li>• La IA también usa la lista de precios, horarios y zonas de cobertura automáticamente</li>
          <li>• Si una pregunta no está en la base de conocimiento, la IA responderá con información general</li>
        </ul>
      </div>
    </div>
  );
}
