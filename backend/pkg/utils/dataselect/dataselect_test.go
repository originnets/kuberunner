package dataselect

import (
	"testing"
	"time"
)

type testCell struct {
	name     string
	creation time.Time
}

func (c testCell) GetCreation() time.Time { return c.creation }
func (c testCell) GetName() string        { return c.name }

func newSelector(limit, page int) *DataSelector {
	base := time.Unix(0, 0)
	return &DataSelector{
		GenericDataList: []DataCell{
			testCell{name: "Pod-A", creation: base.Add(2 * time.Second)},
			testCell{name: "pod-b", creation: base.Add(1 * time.Second)},
			testCell{name: "Other", creation: base},
		},
		DataSelectorQuery: &DataSelectorQuery{
			FilterQuery: &FilterQuery{},
			Pagination:  &PaginateQuery{Limit: limit, Page: page},
		},
	}
}

func TestFilterIsCaseInsensitive(t *testing.T) {
	selector := newSelector(10, 1)
	selector.DataSelectorQuery.FilterQuery.Name = "pod"

	filtered := selector.Filter()

	if got := len(filtered.GenericDataList); got != 2 {
		t.Fatalf("expected 2 matches, got %d", got)
	}
}

func TestPaginateFallsBackToDefaults(t *testing.T) {
	selector := newSelector(0, 0)

	paginated := selector.Paginate()

	// limit=0/page=0 时不应像旧实现那样返回空列表。
	if got := len(paginated.GenericDataList); got != 3 {
		t.Fatalf("expected all 3 items with default limit, got %d", got)
	}
}

func TestPaginateSecondPage(t *testing.T) {
	selector := newSelector(2, 2)

	paginated := selector.Paginate()

	if got := len(paginated.GenericDataList); got != 1 {
		t.Fatalf("expected 1 item on second page, got %d", got)
	}
}

func TestPaginateOutOfRange(t *testing.T) {
	selector := newSelector(10, 5)

	paginated := selector.Paginate()

	if got := len(paginated.GenericDataList); got != 0 {
		t.Fatalf("expected 0 items out of range, got %d", got)
	}
}

func TestPaginateCapsLimit(t *testing.T) {
	selector := newSelector(1_000_000, 1)

	paginated := selector.Paginate()

	if got := len(paginated.GenericDataList); got != 3 {
		t.Fatalf("expected 3 items, got %d", got)
	}
}
