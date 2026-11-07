# syntax=docker/dockerfile:1.7
# OnlyOffice Document Server with exactly one plugin, draw.io, and without the Plugin Manager.
#
# The plugins are installed here, once, when the image is built, and not by the Document Server each time it starts: a start then needs no Internet and always
# yields the same plugin files (PLUGINS_ENABLED=false in docker-compose.yml turns the start-up installation off). The Plugin Manager (the "marketplace" folder) is
# removed so that a person editing a document cannot install a plugin of their own from the marketplace. Which sessions may use draw.io is decided by the backend
# (OnlyOfficeDocumentEditService: the Plugins tab is offered only to a person in Edit mode).
ARG ONLYOFFICE_VERSION=9.4.0.1
FROM onlyoffice/documentserver:${ONLYOFFICE_VERSION}

ARG DRAWIO_PLUGIN=drawio
# The draw.io page of version 8.2 loads its scripts and style from onlyoffice.github.io; the same files are in /sdkjs-plugins/v1 of this server, so the page is
# pointed at those (the build fails if an outside address is left), and a pre-compressed copy that nginx would serve instead is removed.
RUN PLUGINS=/var/www/onlyoffice/documentserver/sdkjs-plugins \
    && documentserver-pluginsmanager.sh -r false --install=${DRAWIO_PLUGIN} \
    && rm -rf "$PLUGINS/marketplace" \
    && DRAWIO_PAGE=$(ls -d "$PLUGINS"/\{*\}/index.html) \
    && test "$(echo "$DRAWIO_PAGE" | wc -l)" = 1 \
    && sed -i 's#https://onlyoffice.github.io/sdkjs-plugins/v1/#../v1/#g' "$DRAWIO_PAGE" \
    && rm -f "$DRAWIO_PAGE.gz" \
    && ! grep -q 'onlyoffice.github.io' "$DRAWIO_PAGE" \
    && chown -R ds:ds "$PLUGINS"
