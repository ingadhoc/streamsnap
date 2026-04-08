# Secrets

PAT_TOKEN

Pasos para crear un PAT:

1. Ve a GitHub - Personal Access Tokens (en tu cuenta de GitHub).
2. Haz clic en "Generate new token". New fine-grained personal access token
3. Da permisos de escritura al token para los repositorios, seleccionando permisos como repo (para acceso completo a los repositorios privados). `New fine-grained personal access token`

    1. Seleccionar el owner (la organización/usuario dueño de `devops-apt-repository`)
    2. Expiration (max)
    3. Seleccionar el repositorio (devops-apt-repository)
    4. Permisos:

        - Contents: RW
        - Metadata: (Mandatory)

4. Copia el token generado.

Agregar el PAT a los secrets:

1. En tu repositorio de origen (el que ejecuta el workflow), ve a Settings > Secrets y crea un nuevo secret llamado PAT_TOKEN (o cualquier nombre que prefieras).
2. Pega el PAT que generaste como valor del secret.

## Variables (opcional)

Este repo publica el `.deb` en otro repositorio (por defecto `adhoc-dev/devops-apt-repository`).
Si en algún momento el repo destino cambia de organización o nombre, podés crear una variable
de repositorio llamada `APT_REPOSITORY` con el valor `owner/repo` (ej: `ingadhoc/devops-apt-repository`).
