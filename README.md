# LavaFlow

Sistema web de gestão e agendamento para lava-jatos (multiempresa), com painéis por perfil de usuário, login com Google, notificações push e arquivamento diário automático dos serviços.

🔗 **Demo:** [premium-sigma-one.vercel.app](https://premium-sigma-one.vercel.app)

---

## ✨ Funcionalidades

- **Agendamento de serviços** com escolha de serviço, horário, veículo e observações adicionais
- **Quatro perfis de acesso**, cada um com seu painel:
  - **Cliente** (`/cliente`): agenda e acompanha seus serviços
  - **Lavador** (`/lavador`): registra e atualiza os serviços em andamento
  - **Administrador da empresa** (`/adm`): gerencia clientes, serviços, status e agenda da empresa
  - **Master / Dev** (`/master`): visão global de todas as empresas e usuários da plataforma
- **Multiempresa:** cada empresa tem seus dados e usuários separados, com link de cadastro próprio (`/cadastro/[empresaId]`)
- **Cadastro de funcionários** (lavadores) pelo administrador, via API com Firebase Admin
- **Autenticação** por e-mail e senha ou conta Google, com sessão por cookie e rotas protegidas
- **Notificações push** (Firebase Cloud Messaging) para avisar, por exemplo, que a lavagem foi concluída
- **Arquivamento diário:** uma rotina agendada move serviços concluídos ou cancelados para um histórico por data
- **Verificação de telefone** no cadastro antes de liberar o uso da conta

---

## 🧰 Tecnologias

**Front-end**
- [Next.js 16](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)

**Back-end e dados**
- Route Handlers do Next.js (API interna)
- [Firebase Authentication](https://firebase.google.com/docs/auth) (e-mail/senha e Google)
- [Cloud Firestore](https://firebase.google.com/docs/firestore) (banco de dados)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging) (notificações push, com Service Worker)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) (operações no servidor)

**Ferramentas e deploy**
- [ESLint 9](https://eslint.org/) com `eslint-config-next`
- [Vercel](https://vercel.com/) (hospedagem e Cron Jobs)

---

## 🚀 Como rodar o projeto

### 1. Pré-requisitos

- [Node.js](https://nodejs.org/) (versão LTS recomendada)
- [Git](https://git-scm.com/)
- Um projeto no [Firebase](https://console.firebase.google.com/) com **Authentication** (e-mail/senha e Google), **Firestore** e **Cloud Messaging** ativados

### 2. Clonando o repositório

```bash
git clone https://github.com/codariadev/lavaflow-app.git
cd lavaflow-app
npm install
```

### 3. Variáveis de ambiente

Crie um arquivo `.env.local` na raiz com as variáveis abaixo:

```env
# Firebase (app web)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

# Firebase Admin (conta de serviço, somente servidor)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Aplicação
NEXT_PUBLIC_MASTER_UID=      # UID do usuário master/dev
NEXT_PUBLIC_APP_VERSION=
CRON_SECRET=                 # protege a rota do cron de arquivamento
```

> ⚠️ **Nunca** envie o `.env.local` nem a chave da conta de serviço para o GitHub. As variáveis `FIREBASE_ADMIN_*` e `CRON_SECRET` são secretas e devem existir apenas no servidor (e nas configurações da Vercel).

### 4. Rodando em desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

---

## 📜 Scripts disponíveis

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera a versão de produção |
| `npm start` | Executa a versão de produção (após o `build`) |
| `npm run lint` | Verifica o código com ESLint |

---

## 📁 Estrutura do projeto

```
lavaflow-app/
├── app/
│   ├── (auth)/             # Login e cadastro
│   ├── adm/                # Painel do administrador da empresa
│   ├── cliente/            # Painel do cliente
│   ├── lavador/            # Painel do lavador
│   ├── master/             # Painel master (visão global)
│   ├── cadastro/[empresaId]/  # Cadastro vinculado a uma empresa
│   ├── api/                # Route Handlers (sessão, notificações, cadastro de funcionário, arquivamento)
│   ├── components/         # Rota protegida, guards de notificação e telefone, rodapé
│   └── lib/                # Configuração do Firebase (cliente e Admin)
├── public/                 # Estáticos e Service Workers (push)
├── proxy.ts                # Proxy do Next.js (redirecionamento e rotas protegidas)
├── verce.json              # Configuração de Cron Jobs
└── package.json
```

---

## 👤 Autor

**CodariaDev** ([@codariadev](https://github.com/codariadev))
