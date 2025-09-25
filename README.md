# 3SIB Discord Bot

Un bot Discord développé en JavaScript pour le serveur 3SIB.

## Prérequis

- Node.js (version 16.9.0 ou plus récente)
- npm ou yarn
- Un compte Discord Developer avec une application bot créée

## Installation

1. Clonez ce repository :
```bash
git clone <url-du-repository>
cd 3SIB-Discord-Bot
```

2. Installez les dépendances :
```bash
npm install
```

3. Créez un fichier `.env` à la racine du projet et ajoutez votre token bot :
```env
DISCORD_TOKEN=votre_token_bot_ici
CLIENT_ID=votre_client_id_ici
GUILD_ID=votre_guild_id_ici
```

## Configuration

1. Allez sur le [Discord Developer Portal](https://discord.com/developers/applications)
2. Créez une nouvelle application ou sélectionnez une existante
3. Dans la section "Bot", copiez le token et ajoutez-le dans votre fichier `.env`
4. Dans la section "General Information", copiez l'Application ID (CLIENT_ID)
5. Activez les intents nécessaires dans la section "Bot" > "Privileged Gateway Intents"

## Utilisation

Pour démarrer le bot :
```bash
npm start
```

Pour le développement avec redémarrage automatique :
```bash
npm run dev
```

## Fonctionnalités

- Commandes slash basiques
- Gestion des événements Discord
- Système de logging
- Configuration modulaire

## Structure du projet

```
3SIB-Discord-Bot/
├── commands/          # Commandes du bot
├── events/            # Gestionnaires d'événements
├── config/            # Fichiers de configuration
├── utils/             # Utilitaires et helpers
├── server/            # Backend Express pour le dashboard
├── public/            # Contenus statiques dashboard 
├── index.js           # Point d'entrée principal
├── deploy-commands.js # Script de déploiement des commandes
└── package.json       # Dépendances et scripts
```

## Commandes disponibles

- `/ping` - Vérifie la latence du bot
- `/help` - Affiche l'aide des commandes

## Contribution

1. Fork le projet
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/ma-fonctionnalite`)
3. Committez vos changements (`git commit -am 'Ajout de ma fonctionnalité'`)
4. Push vers la branche (`git push origin feature/ma-fonctionnalite`)
5. Ouvrez une Pull Request

## Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## Support

Pour toute question ou problème, ouvrez une issue sur ce repository.
