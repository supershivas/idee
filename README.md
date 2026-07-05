# idee
Home-made note editor

## Sécurité — actions recommandées côté Supabase

Ces points ne peuvent pas être corrigés dans le code de l'app et doivent
être appliqués dans le dashboard Supabase :

1. **Realtime sur `page_comments`** : les événements diffusent la ligne
   complète (colonne `author_token` incluse — c'est la preuve de propriété
   des commentaires) à tout client abonné au channel. Retirer la table de la
   publication : `ALTER PUBLICATION supabase_realtime DROP TABLE page_comments;`
   (les commentaires ne se mettront plus à jour en direct pour les autres
   visiteurs d'une page partagée), ou restreindre la colonne via les
   privilèges Postgres.
2. **Buckets Storage `images` / `covers`** : ajouter une limite de taille
   (`file_size_limit`, p. ex. 5 Mo) et un filtre de type MIME
   (`allowed_mime_types = image/*`) — le contrôle côté client peut être
   contourné. Prévoir un nettoyage périodique des fichiers orphelins.
3. **Rate-limit `/api/summarize`** : le limiteur in-memory est inopérant sur
   Vercel (une Map par instance serverless). Pour un vrai plafond, utiliser
   un compteur partagé (Upstash Redis, table Postgres…).
