# Domaines et proxy Traefik du VPS

Ticket : KAN-379, epic KAN-378 « Configuration du VPS ».

## Architecture

Le Traefik global, maintenu dans le depot voisin `proxy-traefik`, publie les
ports 80/443, redirige HTTP vers HTTPS et gere les certificats Let's Encrypt.
Le projet applicatif ne publie aucun port en staging/production.

| Environnement | Interface | API utilisee par React |
| --- | --- | --- |
| Production | `https://docomptia.com` | `https://docomptia.com/api/…` |
| Staging | `https://staging.docomptia.com` | `https://staging.docomptia.com/api/…` |

Traefik envoie `/api` et `/api/…` directement au backend, sans supprimer le
prefixe. Les autres chemins vont au frontend. La priorite explicite du routeur
API (100) depasse celle du frontend (10). `/apiary`, par exemple, reste un chemin
frontend. `VITE_API_BASE_URL=/api` est conserve.

Les domaines API deja declares restent disponibles pour compatibilite :
`api.docomptia.com` et `staging.api.docomptia.com`. Attention : le fichier staging
se nomme `api.staging.docomptia.com.yml`, mais sa regle `Host` utilise bien
`staging.api.docomptia.com`.

Le Nginx du conteneur frontend sert les fichiers Vite et le fallback React vers
`index.html`. Le service Compose `reverse-proxy` et sa configuration Nginx sont
supprimes. Spring utilise deja `server.forward-headers-strategy: framework` et
recoit directement les en-tetes `X-Forwarded-*` de Traefik.

## Reseaux et destinations

Frontend et backend rejoignent le reseau Docker externe `proxy`, deja utilise
par Traefik. Ils conservent aussi leur reseau applicatif `facturation`.
PostgreSQL, MinIO, minio-init et OCR restent uniquement sur ce reseau applicatif.

| Environnement | Alias frontend | Alias backend |
| --- | --- | --- |
| Production | `docomptia-prod-frontend:80` | `docomptia-prod-backend:8080` |
| Staging | `docomptia-staging-frontend:80` | `docomptia-staging-backend:8080` |

Sur le reseau partage, Traefik utilise exclusivement ces alias distincts,
jamais les noms generiques `frontend` ou `backend`. Les deux environnements
doivent conserver des noms de projet Compose differents : les exemples utilisent
`docomptia-prod` et `docomptia-staging` (`docomptia-dev` en developpement).

Le reseau `proxy` est partage avec les autres applications du VPS ; il ne constitue
pas une isolation entre elles. Le developpement local ne rejoint pas ce reseau.

## Configuration du proxy global

Le fournisseur `file` est deja active dans `proxy-traefik/traefik.yml`.
Les labels Docker ne sont pas utilises. Les modifications sont dans :

```text
dynamic/apps/production/docomptia.com.yml
dynamic/apps/production/api.docomptia.com.yml
dynamic/apps/staging/staging.docomptia.com.yml
dynamic/apps/staging/api.staging.docomptia.com.yml
dynamic/middlewares/docomptia-upload.yml
```

Le middleware `docomptia-upload-limit-25m` limite le corps des requetes API a
26 214 400 octets (25 Mio), comme l'ancien reverse proxy et la limite multipart
Spring. Cette limite porte sur la requete entiere, enveloppe multipart comprise.
La limite metier de 10 Mo par facture reste inchangee. Les limites partagees des
autres applications du VPS restent inchangees.

## Premiere migration sur le VPS

Effectuer d'abord la bascule staging, puis la production. Les deux depots doivent
etre mis a jour ensemble ; deployer seulement le projet applicatif laisse
Traefik pointer vers ses anciennes destinations.

1. Verifier les enregistrements DNS A des domaines utilises vers l'IPv4 du VPS.
   Si des AAAA existent, ils doivent pointer vers une IPv6 desservie par ce VPS.
   Les ports publics 80 et 443 doivent atteindre Traefik ; le challenge ACME
   configure utilise HTTP sur le port 80.
2. Sauvegarder les fichiers dynamiques Traefik concernes en dehors de `dynamic/`
   et relever les revisions applicatives/proxy avant la bascule.
3. Verifier le reseau avec `docker network inspect proxy`. S'il n'existe pas,
   le creer avec `docker network create proxy`. Traefik doit y etre connecte.
4. Dans les fichiers existants `env/.env.staging` et `env/.env.prod`, conserver
   les secrets. Ne pas recopier les fichiers
   d'exemple par-dessus. Mettre `APP_CORS_ALLOWED_ORIGINS` respectivement a
   `https://staging.docomptia.com` et `https://docomptia.com`, conserver
   `VITE_API_BASE_URL=/api` et retirer l'ancienne variable `HTTP_PORT`.
   Definir `COMPOSE_PROJECT_NAME=docomptia-staging` ou `docomptia-prod`.
   Pour une installation existante portant un autre nom, suivre d'abord
   [la procedure de renommage](#renommer-un-projet-compose-existant) : les volumes
   et conteneurs de l'ancien projet ne sont pas repris automatiquement.
5. Avant de remplacer les fichiers du proxy actif, valider une copie candidate
   de son arborescence complete avec `make validate` dans cette copie.
   Le validateur utilise un conteneur sans reseau et ne contacte pas Let's Encrypt.
6. Deployer l'application avec `make staging` ou `make prod` dans son depot.
   Les commandes et workflows utilisent `--remove-orphans` pour retirer
   l'ancien conteneur `reverse-proxy` du projet Compose concerne. Cette option
   retire aussi tout autre conteneur orphelin de ce meme projet : verifier qu'il
   n'heberge pas de service volontairement absent du Compose. Les volumes de
   donnees ne sont pas supprimes. Une courte interruption est possible.
7. Installer les fichiers Traefik de l'environnement concerne et le middleware
   `docomptia-upload.yml`, puis executer `make reload` dans le depot du proxy.
   Le middleware doit etre installe avant le routeur API qui le reference.
   Ne pas activer les destinations de l'autre environnement avant son deploiement.
   `make reload` valide puis touche le fichier declencheur a la racine de
   `dynamic/`, pour prendre en compte les modifications des sous-dossiers.
8. Mettre les secrets GitHub `STAGING_HEALTHCHECK_URL` et `PROD_HEALTHCHECK_URL`
   respectivement a `https://staging.docomptia.com/api/hello` et
   `https://docomptia.com/api/hello`.

## Renommer un projet Compose existant

Changer `COMPOSE_PROJECT_NAME` change aussi les noms generes pour les conteneurs,
reseaux et volumes. Sans preparation, Compose cree de nouveaux volumes vides.
`--remove-orphans` ne retire pas les conteneurs de l'ancien projet.

Avant de demarrer sous le nouveau nom :

1. Relever le nom Compose reellement deploye et les noms des volumes PostgreSQL
   et MinIO avec `docker volume ls` et `docker inspect` sur leurs conteneurs.
   Sauvegarder les donnees.
2. Arreter l'ancien projet avec ses fichiers Compose et son fichier d'environnement,
   en precisant son nom avec `docker compose -p <ancien-nom> … down`, sans `-v`.
3. Reutiliser explicitement les volumes existants dans un override Compose local,
   ou migrer leurs donnees vers les nouveaux volumes avant le demarrage.
4. Reporter le nouveau `COMPOSE_PROJECT_NAME` dans le fichier d'environnement
   et utiliser la meme configuration de volumes dans toutes les commandes de
   demarrage et de deploiement, y compris les workflows GitHub.

Exemple d'override pour reutiliser les volumes d'une ancienne production nommee
`facturation-prod`, apres verification de leurs noms reels :

```yaml
volumes:
  postgres_data:
    external: true
    name: facturation-prod_postgres_data
  minio_data:
    external: true
    name: facturation-prod_minio_data
```

Cet override doit etre passe apres les autres fichiers avec `-f` tant que ces
volumes sont utilises. Adapter les noms pour staging ou dev. Ne jamais demarrer
simultanement deux PostgreSQL sur le meme volume. Aucune migration des donnees
ou des conteneurs existants n'est effectuee par la modification des fichiers
d'exemple de ce depot.

## Verification apres bascule

Pour le staging, puis avec `docomptia.com` pour la production :

```bash
curl --head http://staging.docomptia.com
curl --fail --show-error https://staging.docomptia.com/
curl --fail --show-error https://staging.docomptia.com/api/hello
```

Attendre une redirection vers HTTPS, le HTML React, puis `Hello World` pour
l'API. Ne pas utiliser `-k` ici : le certificat public doit etre valide.
Verifier aussi dans le navigateur une URL React profonde, la connexion et
l'envoi d'une facture. Une requete API depassant 25 Mio doit recevoir HTTP 413.
Les domaines API historiques doivent toujours atteindre le bon environnement.

Verifier avec `docker compose … ps` que `reverse-proxy` a disparu, qu'aucun
port hote applicatif n'est publie et que les services sont demarres. Les ports
`80/tcp` et `8080/tcp` indiques seuls sont internes ; ils ne doivent pas apparaitre
sous la forme `0.0.0.0:…->…`. Consulter les logs de Traefik en cas de 502/503.

## Retour arriere

Restaurer les revisions applicatives et les routes Traefik sauvegardees ensemble,
sans supprimer les volumes. L'ancien Compose production publie le port 80 :
tant que Traefik l'occupe, configurer temporairement `HTTP_PORT=127.0.0.1:8082`
(ou un port local libre) avant de relancer cet ancien Compose. Le retour arriere
du routage public doit correspondre aux services reellement disponibles ; les
anciennes destinations `reactjs:3000` / `api:1080` ne ciblent pas automatiquement
l'ancien reverse proxy de ce projet. Valider et recharger Traefik apres adaptation.
