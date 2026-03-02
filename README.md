📱 Sistema de Órdenes de Trabajo (OT) – Mobile First

Sistema web diseñado para reemplazar órdenes de trabajo en papel por una solución digital optimizada para operarios de campo y encargados.

Desarrollado como solución real para una empresa del sector agroindustrial, con foco en usabilidad, trazabilidad y eficiencia operativa.

🚀 Problema que resuelve

El proceso tradicional dependía de órdenes impresas:

Traslado físico entre oficina y campo

Demoras en asignación

Retrasos en validación

Riesgo de pérdida de información

El sistema digitaliza completamente el flujo operativo.

🧠 Solución

Aplicación web mobile-first con:

Asignación de órdenes en tiempo real

Carga de datos desde el campo

Revisión y aprobación digital

Integración con sistema externo (SIGECOM)

Eliminación total del papel

🏗 Arquitectura

Proyecto estructurado como monorepo:
/backend   → API REST en Laravel
/frontend  → Aplicación React (Vite)
🔧 Backend

Laravel (PHP)

API REST

Manejo de roles (Operario / Encargado)

Validaciones y lógica de negocio

Integración con sistema externo

🎨 Frontend

React

Vite

TailwindCSS

Diseño mobile-first

Interfaz simplificada y altamente intuitiva

🎯 Enfoque en UX

Diseñado específicamente para operarios de campo con bajo uso habitual de tecnología:

Botones grandes

Flujo paso a paso

Interfaz limpia

Minimización de errores

Pensado 100% para uso en celular

La prioridad fue adaptar el sistema al usuario, no el usuario al sistema.

⚙️ Instalación

📦 Backend (Laravel)
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve

💻 Frontend (React)
cd frontend
npm install
npm run dev

🔐 Variables de entorno

Las credenciales y configuraciones sensibles no están incluidas en este repositorio.

Crear archivo .env basado en .env.example.

📈 Resultado

Eliminación total del papel

Reducción de tiempos muertos

Mayor trazabilidad operativa

Flujo más ágil entre campo y administración

👨‍💻 Autor

Desarrollado íntegramente por Ignacio Casteran
Backend + Frontend + Arquitectura + Implementación

Primera comercialización de un sistema desarrollado de manera independiente.
