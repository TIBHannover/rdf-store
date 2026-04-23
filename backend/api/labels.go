package api

import (
	"log/slog"
	"net/http"
	"rdf-store-backend/rdf"

	"github.com/gin-gonic/gin"
)

// init registers the label and description lookup endpoints on the router.
func init() {
	Router.POST(BasePath+"/labels", handleLabels)
	Router.POST(BasePath+"/descriptions", handleDescriptions)
}

// handleLabels resolves labels for provided RDF IDs and language.
func handleLabels(c *gin.Context) {
	language := c.PostForm("lang")
	ids := c.PostFormArray("id")
	labels, err := rdf.GetLabels(language, ids)
	if err != nil {
		slog.Error("failed getting labels", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, labels)
}

// handleDescriptions resolves dc:description values for provided RDF IDs and language.
func handleDescriptions(c *gin.Context) {
	language := c.PostForm("lang")
	ids := c.PostFormArray("id")
	descriptions, err := rdf.GetDescriptions(language, ids)
	if err != nil {
		slog.Error("failed getting descriptions", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, descriptions)
}
