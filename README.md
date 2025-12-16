# Pulmonar — Backend (NestJS)

Backend de un sistema de “Desarrollo Pulmonar”, creado como parte de mi TFG. Consiste en una aplicación web para el seguimiento de pacientes en un ensayo clínico. Provee una **API REST** para la gestión de usuarios/roles, pacientes, grupos, formularios/encuestas, evaluaciones, citas, notificaciones y estadísticas. El sistema usa **JWT** y control de acceso por rol.

## Stack
- **Node.js + TypeScript**
- **NestJS** (arquitectura modular, validación con DTOs, guards, etc.)
- **TypeORM + MySQL** (modelo relacional)
- **JWT** (auth)
- **Swagger** (documentación del contrato de la API)

## Funcionalidades principales (por áreas)
- **Auth**: login y selección de rol.
- **Users**: alta/listado/edición de usuarios (según rol).
- **Pacientes**: gestión de pacientes y su información.
- **Grupos**: asignación de pacientes y revisores, trazabilidad.
- **Surveys/Formularios**: formularios con secciones, preguntas y respuestas.
- **Evaluations**: creación y registro de evaluaciones y respuestas.
- **Appointments/Citas**: citación y gestión de estado.
- **Stats**: estadísticas globales y por paciente.
- **Notifications**: notificaciones del sistema.

> En el sistema, el acceso se controla por rol a nivel de rutas/operaciones (p.ej., alta de usuario solo coordinador, pasar evaluación solo tutor).


## Requisitos
- Node.js (recomendado LTS)
- MySQL (base de datos disponible y con el esquema esperado)

## Configuración (.env)
Este proyecto usa variables de entorno para conectar con la BD y configurar JWT.

1) Crea un `.env` a partir de `.env.example`:
```bash
cp .env.example .env
