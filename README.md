# Pulmonar Backend (NestJS)

Backend API para la plataforma **Pulmonar**. Implementa autenticación con JWT y endpoints organizados por módulos (usuarios, pacientes, encuestas, evaluaciones, estadísticas, etc.). Pensado para ser consumido por el frontend en Flutter.

## Stack
- **Node.js + NestJS**
- **TypeScript**
- **TypeORM**
- **MySQL**
- **JWT Auth** (Passport)
- Testing: **Jest** (e2e incluido en `/test`)

## Módulos principales
Según la estructura del proyecto:
- `auth` (login, JWT, roles/guards)
- `users`
- `pacientes`
- `revisores`
- `coordinadores`
- `surveys` (encuestas/cuestionarios)
- `evaluations` (evaluaciones/respuestas)
- `stats` (estadísticas)
- `appointments` (citas)
- `notifications`
- `health` (healthcheck)

> Nota: la API está estructurada con controladores/servicios/DTOs por módulo siguiendo buenas prácticas de NestJS.

---

## Requisitos
- Node.js (recomendado **LTS**)
- MySQL (local o remoto)

---

## Configuración

### 1) Variables de entorno
Crea tu `.env` a partir del ejemplo:

```bash
cp .env.example .env
