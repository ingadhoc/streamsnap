# Secrets

El workflow `release.yml` publica el `.deb` en `adhoc-dev/devops-apt-repository` con un
token de la GitHub App **`adhoc-apt-publisher`** (dueña: org `adhoc-dev`). El propio
workflow emite el token en cada corrida: vive una hora, solo puede escribir en ese repo y
se revoca al terminar el job. No hay un token personal que renovar.

Lo que este repo necesita:

| Nombre | Tipo | Valor |
|---|---|---|
| `APT_PUBLISHER_CLIENT_ID` | Variable | Client ID de la App (no es secreto; está en la página de la App) |
| `APT_PUBLISHER_PRIVATE_KEY` | Secret | Clave privada `.pem` de la App (guardada en Bitwarden) |

Los nombres van **exactos**: el workflow los lee hardcodeados, y con cualquier otro nombre
el paso `Generate APT publisher token` falla.

Para cargarlos en un repo:

```bash
gh variable set APT_PUBLISHER_CLIENT_ID --repo ingadhoc/<repo> --body '<Client ID>'
gh secret set APT_PUBLISHER_PRIVATE_KEY --repo ingadhoc/<repo> < adhoc-apt-publisher.<fecha>.private-key.pem
```

La App tiene un solo permiso (`Contents: Read and write`) y está instalada solo sobre
`devops-apt-repository`.

## Por qué no alcanza con `GITHUB_TOKEN`

El push al repo APT tiene que disparar su workflow `Update APT Repository`, que regenera la
metadata y publica en GitHub Pages. Un push hecho con `GITHUB_TOKEN` no dispara workflows;
uno hecho con el token de una GitHub App, sí.

## Variables (opcional)

Este repo publica el `.deb` en otro repositorio (por defecto `adhoc-dev/devops-apt-repository`).
Si en algún momento el repo destino cambia de organización o nombre, podés crear una variable
de repositorio llamada `APT_REPOSITORY` con el valor `owner/repo`. Además hay que cambiar
`owner` y `repositories` en el paso `Generate APT publisher token` e instalar la App sobre el
repo nuevo: el token solo sirve para los repos que tiene la instalación.
